import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import prisma from '../db/client';

jest.mock('../db/client', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

// Mock environment
process.env.NODE_ENV = 'test';
process.env.PUBSUB_EMULATOR_HOST = 'localhost:8085';
process.env.GCP_PROJECT_ID = 'test-project';
