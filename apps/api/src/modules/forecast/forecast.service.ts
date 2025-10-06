import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';

type TSPoint = { ds: string; y: number };

@Injectable()
export class ForecastService {
  private readonly SOLVER = process.env.SOLVER_URL ?? 'http://127.0.0.1:5001';

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private redis: RedisService,
  ) { }

  private async orgId(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
      select: { id: true, timezone: true },
    });
    if (!org) throw new HttpException('Org not found', 404);
    return org.id;
  }

  // Build 8 weeks of daily totals from ShiftDemandTemplate pattern.
  private async buildSeries(orgId: string, weeks = 8): Promise<TSPoint[]> {
    const templates = await this.prisma.shiftDemandTemplate.findMany({
      where: { location: { orgId } },
      select: { weekday: true, required: true },
    });

    // daily required = sum(required) across templates for that weekday
    const weekdayTotals = new Array(7).fill(0);
    for (const t of templates) weekdayTotals[t.weekday] += t.required;

    const start = new Date(); // today as reference end
    const days = weeks * 7;
    const series: TSPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(start.getDate() - i);
      const wd = d.getDay();
      const y = weekdayTotals[wd] || 0;
      series.push({ ds: d.toISOString().slice(0, 10), y });
    }
    return series;
  }

  private cacheKey(orgId: string, horizon: number) {
    return `forecast:${orgId}:${horizon}`;
  }

  async run(orgRef: string, horizon_days = 14) {
    const orgId = await this.orgId(orgRef);
    const key = this.cacheKey(orgId, horizon_days);

    // 1) try cache
    const cached = await this.redis.getJSON<{ history: TSPoint[]; forecast: any }>(key);
    if (cached) return cached;

    // 2) compute + call solver
    const series = await this.buildSeries(orgId, 8);
    const payload = {
      series,
      horizon_days,
      seasonal_period: 7,
      backtest_folds: 3,
    };

    const resp = await firstValueFrom(
      this.http.post(`${this.SOLVER}/forecast`, payload, { timeout: 20000 }),
    );

    const out = { history: series, forecast: resp.data }; // yhat, bands, mape, folds

    // 3) cache result (5 min TTL)
    await this.redis.setJSON(key, out, 300);

    return out;
  }
}
