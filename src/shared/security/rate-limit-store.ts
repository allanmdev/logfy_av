export interface RateLimitStore {
  consume(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }>;
}
