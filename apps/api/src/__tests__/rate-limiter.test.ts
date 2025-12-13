import { Request, Response, NextFunction } from 'express';

// Mock Redis before importing rate limiter
const mockPipeline = {
  zremrangebyscore: jest.fn().mockReturnThis(),
  zcard: jest.fn().mockReturnThis(),
  zadd: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    pipeline: jest.fn().mockReturnValue(mockPipeline),
  }));
});

import { conditionalRateLimiter, skipRateLimitPaths } from '../middleware/rate-limiter';

describe('Rate Limiter Middleware', () => {
  let mockReq: any;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      ip: '127.0.0.1',
      path: '/monitors',
      user: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();

    // Default: allow requests (simulate count under limit)
    mockPipeline.exec.mockResolvedValue([
      [null, 0], // zremrangebyscore result
      [null, 5], // zcard result (5 requests, under limit)
      [null, 1], // zadd result
      [null, 1], // expire result
    ]);
  });

  describe('skipRateLimitPaths', () => {
    it('should include health endpoint', () => {
      expect(skipRateLimitPaths).toContain('/health');
    });

    it('should include docs endpoint', () => {
      expect(skipRateLimitPaths).toContain('/docs');
    });

    it('should include openapi.json endpoint', () => {
      expect(skipRateLimitPaths).toContain('/openapi.json');
    });
  });

  describe('conditionalRateLimiter', () => {
    it('should skip rate limiting for health endpoint', () => {
      mockReq.path = '/health';

      conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for docs endpoint', () => {
      mockReq.path = '/docs/';

      conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should apply rate limiting to protected endpoints', async () => {
      mockReq.path = '/monitors';

      // The rate limiter is async, need to call and wait
      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);

      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    });
  });

  describe('rate limit headers', () => {
    it('should set X-RateLimit-Limit header', async () => {
      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
    });

    it('should set X-RateLimit-Remaining header', async () => {
      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });

    it('should set X-RateLimit-Reset header', async () => {
      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });
  });

  describe('rate limit exceeded', () => {
    beforeEach(() => {
      // Simulate rate limit exceeded (count at limit)
      mockPipeline.exec.mockResolvedValue([
        [null, 0],
        [null, 25], // At or over unauthenticated limit of 20
        [null, 1],
        [null, 1],
      ]);
    });

    it('should return 429 when rate limit exceeded', async () => {
      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
        })
      );
    });

    it('should set Retry-After header when exceeded', async () => {
      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('tiered rate limits', () => {
    it('should use unauthenticated tier for requests without user', async () => {
      mockReq.user = undefined;

      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Unauthenticated limit is 20
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 20);
    });

    it('should use authenticated tier for token auth', async () => {
      mockReq.user = { uid: 'user-123', email: 'test@test.com' };
      (mockReq as any).authType = 'token';

      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Authenticated limit is 100
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    });

    it('should use API key tier for API key auth', async () => {
      mockReq.user = { uid: 'user-123', email: 'test@test.com' };
      (mockReq as any).authType = 'apiKey';
      (mockReq as any).apiKeyId = 'key-123';

      await conditionalRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 10));

      // API key limit is 1000
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1000);
    });
  });
});
