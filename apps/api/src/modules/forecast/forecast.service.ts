import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from 'src/redis/redis.service';

type TSPoint = { ds: string; y: number };

type SolverFold =
  | { fold: number; mape: number; mae?: number; rmse?: number }
  | { foldIndex: number; mape: number; mae?: number; rmse?: number };

type SolverForecast = {
  // Your solver already returns these as TSPoint[] (per your UI)
  yhat: TSPoint[];
  yhat_lower: TSPoint[];
  yhat_upper: TSPoint[];
  // Backtest summaries (any of these may appear)
  mape?: number | null;
  backtests?: SolverFold[];
  folds?: Array<number | SolverFold>;
};

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

    const weekdayTotals = new Array(7).fill(0);
    for (const t of templates) weekdayTotals[t.weekday] += t.required;

    const start = new Date();
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

    // 1) cache
    const cached = await this.redis.getJSON<{ history: TSPoint[]; forecast: SolverForecast }>(key);
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
    const forecast = resp.data as SolverForecast;

    // 3) persist (best-effort; won’t affect response)
    try {
      // normalize folds
      const rawFolds: SolverFold[] =
        (forecast.backtests as SolverFold[] | undefined) ??
        (Array.isArray(forecast.folds)
          ? forecast.folds
            .map((f, i) =>
              typeof f === 'number' ? { foldIndex: i + 1, mape: f } : f,
            )
          : []);

      const foldRows = rawFolds
        .filter((f) => typeof (f as any).mape === 'number')
        .map((f) => ({
          foldIndex: 'fold' in f ? (f as any).fold : (f as any).foldIndex ?? 0,
          mape: (f as any).mape as number,
          mae: (f as any).mae ?? null,
          rmse: (f as any).rmse ?? null,
        }));

      const mapeAvg =
        typeof forecast.mape === 'number'
          ? forecast.mape
          : foldRows.length
            ? foldRows.reduce((a, b) => a + b.mape, 0) / foldRows.length
            : 0;

      const run = await this.prisma.forecastRun.create({
        data: {
          orgId,
          method: 'statsmodels', // keep your default
          horizonDays: horizon_days,
          mapeAvg,
        },
      });

      if (foldRows.length) {
        await this.prisma.forecastFold.createMany({
          data: foldRows.map((f) => ({
            runId: run.id,
            foldIndex: f.foldIndex,
            mape: f.mape,
            mae: f.mae,
            rmse: f.rmse,
          })),
        });
      }
    } catch {
      // swallow
    }

    const out = { history: series, forecast };
    await this.redis.setJSON(key, out, 300); // 5 min TTL
    return out;
  }

  // List persisted runs with folds
  listRuns(orgRef: string, limit = 20) {
    return this.orgId(orgRef).then((orgId) =>
      this.prisma.forecastRun.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(limit, 100)),
        include: { folds: { orderBy: { foldIndex: 'asc' } } },
      }),
    );
  }
}
