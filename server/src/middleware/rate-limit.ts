import type { Request, Response, NextFunction, RequestHandler } from 'express';

interface Bucket { count: number; resetAt: number }

/**
 * Small fixed-window, in-process rate limiter (single-server deployment, like the existing
 * job queue). Keys on the authenticated user when present, otherwise the client IP.
 * For a multi-instance deployment replace the Map with a shared store (e.g. Redis).
 */
export function rateLimit(options: { name: string; windowMs: number; max: number }): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (now - lastSweep > options.windowMs) {
      for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      lastSweep = now;
    }
    const key = `${options.name}:${req.user?.id || req.ip || 'unknown'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    next();
  };
}
