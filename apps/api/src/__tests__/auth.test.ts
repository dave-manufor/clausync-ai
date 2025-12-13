import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';

// Mock google-auth-library
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('Development Mode', () => {
    beforeAll(() => {
      process.env.PUBSUB_EMULATOR_HOST = 'localhost:8085';
    });

    it('should allow requests without auth header in dev mode', async () => {
      await authenticate(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({ uid: 'dev-user-001', email: 'dev@localhost' });
    });

    it('should set dev user when Authorization header missing', async () => {
      mockReq.headers = {};

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user?.uid).toBe('dev-user-001');
      expect(mockReq.user?.email).toBe('dev@localhost');
    });
  });

  describe('Production Mode', () => {
    beforeAll(() => {
      delete process.env.PUBSUB_EMULATOR_HOST;
      process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
      process.env.PUBSUB_EMULATOR_HOST = 'localhost:8085';
      process.env.NODE_ENV = 'test';
    });

    it('should reject requests without Authorization header', async () => {
      mockReq.headers = {};

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Authorization header required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid Bearer format', async () => {
      mockReq.headers = { authorization: 'Basic abc123' };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
