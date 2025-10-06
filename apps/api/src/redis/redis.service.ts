import { Global, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';

@Global()
@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: RedisClient;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.client = new Redis(url, { lazyConnect: false });
    this.client.on('error', (e) => console.error('[redis] error', e?.message || e));
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  ping() {
    return this.client.ping();
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    return v ? (JSON.parse(v) as T) : null;
  }

  async setJSON(key: string, value: any, ttlSec?: number) {
    const s = JSON.stringify(value);
    if (ttlSec && ttlSec > 0) {
      await this.client.set(key, s, 'EX', ttlSec);
    } else {
      await this.client.set(key, s);
    }
  }

  del(key: string) {
    return this.client.del(key);
  }

  keys(pattern: string) {
    return this.client.keys(pattern);
  }
}
