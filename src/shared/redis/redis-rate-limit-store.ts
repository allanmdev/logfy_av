import type Redis from 'ioredis';
import { RateLimitStore } from '../security/rate-limit-store';

const script = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: Redis, private readonly prefix = 'logfy:rate-limit') {}

  async consume(key: string, windowMs: number) {
    const result = await this.client.eval(script, 1, `${this.prefix}:${key}`, windowMs);
    if (!Array.isArray(result) || result.length !== 2 ||
      !Number.isInteger(result[0]) || !Number.isInteger(result[1]) ||
      result[0] < 1 || result[1] < 0) {
      throw new Error('Invalid rate limit response');
    }
    return { count: Number(result[0]), ttlMs: Number(result[1]) };
  }
}
