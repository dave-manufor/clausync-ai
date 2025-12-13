import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

// Redis client - uses same instance as the app
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Skip rate limiting in development unless explicitly enabled
const SKIP_RATE_LIMIT_IN_DEV = process.env.RATE_LIMIT_ENABLED !== 'true' && 
  (process.env.NODE_ENV === 'development' || process.env.PUBSUB_EMULATOR_HOST);

// Rate limits by authentication tier (higher for development)
const RATE_LIMITS = {
  unauthenticated: { requests: 60, windowSeconds: 60 },    // 60/min
  authenticated: { requests: 300, windowSeconds: 60 },     // 300/min
  apiKey: { requests: 3000, windowSeconds: 60 },           // 3000/min
};

type RateLimitTier = keyof typeof RATE_LIMITS;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Check rate limit using sliding window algorithm
 */
async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[tier];
  const key = `ratelimit:${tier}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  // Use Redis transaction for atomic operations
  const pipeline = redis.pipeline();
  
  // Remove old entries outside the window
  pipeline.zremrangebyscore(key, 0, windowStart);
  
  // Count current entries
  pipeline.zcard(key);
  
  // Add current request
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  
  // Set expiry
  pipeline.expire(key, config.windowSeconds);

  const results = await pipeline.exec();
  const currentCount = results?.[1]?.[1] as number || 0;
  
  const allowed = currentCount < config.requests;
  const remaining = Math.max(0, config.requests - currentCount - 1);
  const reset = Math.ceil((windowStart + config.windowSeconds * 1000) / 1000);

  return {
    allowed,
    remaining,
    reset,
    limit: config.requests,
  };
}

/**
 * Rate limiting middleware
 * Sets X-RateLimit-* headers and returns 429 when exceeded
 */
export const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Determine tier and identifier
    let tier: RateLimitTier = 'unauthenticated';
    let identifier = req.ip || 'unknown';

    if (req.user) {
      if ((req as any).authType === 'apiKey') {
        tier = 'apiKey';
        identifier = (req as any).apiKeyId || req.user.uid;
      } else {
        tier = 'authenticated';
        identifier = req.user.uid;
      }
    }

    const result = await checkRateLimit(identifier, tier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.reset);

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(RATE_LIMITS[tier].windowSeconds));
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${RATE_LIMITS[tier].windowSeconds} seconds.`,
        retryAfter: RATE_LIMITS[tier].windowSeconds,
      });
      return;
    }

    next();
  } catch (error) {
    // On Redis error, allow request but log
    console.error('Rate limiter error:', error);
    next();
  }
};

/**
 * Skip rate limiting for health checks and development
 */
export const skipRateLimitPaths = ['/health', '/docs', '/openapi.json'];

export const conditionalRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip rate limiting in development mode
  if (SKIP_RATE_LIMIT_IN_DEV) {
    next();
    return;
  }
  
  if (skipRateLimitPaths.some(path => req.path.startsWith(path))) {
    next();
    return;
  }
  rateLimiter(req, res, next);
};
