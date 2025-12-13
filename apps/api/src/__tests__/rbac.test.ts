import { Request, Response, NextFunction } from 'express';
import { requireRole, requirePermission, requireOrgMembership } from '../middleware/rbac';

// Mock prisma
jest.mock('../db/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../db/client';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('RBAC Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { uid: 'test-uid', email: 'test@example.com', emailVerified: true },
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('requireRole middleware', () => {
    it('should return 401 if no user', async () => {
      mockReq.user = undefined;
      const middleware = requireRole('admin');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 if user not found in DB', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const middleware = requireRole('admin');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass for user with required role', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'admin',
        organizationId: 'org-123',
      });
      const middleware = requireRole('admin');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).userRole).toBe('admin');
    });

    it('should pass for user with higher role', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'owner',
        organizationId: 'org-123',
      });
      const middleware = requireRole('admin');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny user with lower role', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'member',
        organizationId: 'org-123',
      });
      const middleware = requireRole('admin');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission middleware', () => {
    it('should pass for user with permission', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'admin',
        organizationId: 'org-123',
      });
      const middleware = requirePermission('monitors:read');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny user without permission', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'viewer',
        organizationId: 'org-123',
      });
      const middleware = requirePermission('monitors:write');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOrgMembership middleware', () => {
    it('should return 400 if no org ID in params', async () => {
      mockReq.params = {};

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 403 if user not in org', async () => {
      mockReq.params = { id: 'org-123' };
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        organizationId: 'different-org',
        role: 'member',
      });

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should pass if user is org member', async () => {
      mockReq.params = { id: 'org-123' };
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-123',
        role: 'member',
      });

      await requireOrgMembership(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).dbUserId).toBe('user-1');
    });
  });
});
