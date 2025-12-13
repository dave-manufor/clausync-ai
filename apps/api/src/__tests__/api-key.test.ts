import { Request, Response, NextFunction } from 'express';
import { requireScope, generateApiKey, authenticateApiKey } from '../middleware/api-key';

// Mock prisma
jest.mock('../db/client', () => ({
  __esModule: true,
  default: {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('API Key Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: undefined,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('generateApiKey', () => {
    it('should generate a live key with correct prefix', () => {
      const { key, prefix } = generateApiKey('live');
      expect(key).toMatch(/^clau_live_[A-Za-z0-9_-]+$/);
      expect(prefix).toBe('clau_live_');
    });

    it('should generate a test key with correct prefix', () => {
      const { key, prefix } = generateApiKey('test');
      expect(key).toMatch(/^clau_test_[A-Za-z0-9_-]+$/);
      expect(prefix).toBe('clau_test_');
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey('live');
      const key2 = generateApiKey('live');
      expect(key1.key).not.toBe(key2.key);
    });

    it('should generate keys of consistent length', () => {
      const { key } = generateApiKey('live');
      // Prefix (10) + 32 chars from base64url encoded 24 bytes
      expect(key.length).toBeGreaterThan(30);
    });
  });

  describe('requireScope middleware', () => {
    it('should pass if not authenticated via API key', () => {
      const middleware = requireScope('monitors:read');
      mockReq.user = { uid: 'user-123', email: 'test@test.com', emailVerified: true };
      (mockReq as any).authType = 'token'; // Not API key

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass with correct scope', () => {
      const middleware = requireScope('monitors:read');
      mockReq.user = { uid: 'user-123', email: 'test@test.com', emailVerified: true };
      (mockReq as any).authType = 'apiKey';
      (mockReq as any).apiKeyScopes = ['monitors:read', 'changes:read'];

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass with wildcard scope', () => {
      const middleware = requireScope('monitors:read');
      mockReq.user = { uid: 'user-123', email: 'test@test.com', emailVerified: true };
      (mockReq as any).authType = 'apiKey';
      (mockReq as any).apiKeyScopes = ['*'];

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject with missing scope', () => {
      const middleware = requireScope('monitors:write');
      mockReq.user = { uid: 'user-123', email: 'test@test.com', emailVerified: true };
      (mockReq as any).authType = 'apiKey';
      (mockReq as any).apiKeyScopes = ['monitors:read'];

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          requiredScopes: ['monitors:write'],
        })
      );
    });

    it('should require all scopes when multiple are specified', () => {
      const middleware = requireScope('monitors:read', 'changes:read');
      mockReq.user = { uid: 'user-123', email: 'test@test.com', emailVerified: true };
      (mockReq as any).authType = 'apiKey';
      (mockReq as any).apiKeyScopes = ['monitors:read']; // Missing changes:read

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('authenticateApiKey middleware', () => {
    it('should skip if no API key header', async () => {
      await authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should skip if not API key format', async () => {
      mockReq.headers = { authorization: 'Bearer some-jwt-token' };

      await authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });
});
