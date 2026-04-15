import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '../src/middleware/auth';

// Provide a mock config that tests can override per-case
const mockConfig = { API_KEY: undefined as string | undefined };

jest.mock('../src/config', () => ({
  get config() {
    return mockConfig;
  },
}));

jest.mock('../src/infrastructure/Logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createMockReq(headers: Record<string, string | undefined> = {}): Partial<Request> {
  return { headers, ip: '127.0.0.1', path: '/api/test' };
}

function createMockRes(): Partial<Response> & { statusCode: number; body: unknown } {
  const res: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res as Response;
    },
    json(obj: unknown) {
      res.body = obj;
      return res as Response;
    },
  };
  return res;
}

describe('apiKeyAuth middleware', () => {
  it('should call next() when API_KEY is not configured', () => {
    mockConfig.API_KEY = undefined;
    const next = jest.fn();
    apiKeyAuth(createMockReq() as Request, createMockRes() as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 when API_KEY is set but header is missing', () => {
    mockConfig.API_KEY = 'a'.repeat(32);
    const next = jest.fn();
    const res = createMockRes();
    apiKeyAuth(createMockReq() as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('should return 401 when API_KEY is set but header is wrong', () => {
    mockConfig.API_KEY = 'a'.repeat(32);
    const next = jest.fn();
    const res = createMockRes();
    apiKeyAuth(createMockReq({ 'x-api-key': 'wrong-key' }) as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('should call next() when the correct API key is provided', () => {
    const key = 'a'.repeat(32);
    mockConfig.API_KEY = key;
    const next = jest.fn();
    const res = createMockRes();
    apiKeyAuth(createMockReq({ 'x-api-key': key }) as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200); // untouched
  });

  it('should reject keys that differ only in one character (timing-safe)', () => {
    const key = 'a'.repeat(31) + 'b';
    mockConfig.API_KEY = key;
    const almostKey = 'a'.repeat(31) + 'c';
    const next = jest.fn();
    const res = createMockRes();
    apiKeyAuth(createMockReq({ 'x-api-key': almostKey }) as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('should reject keys of different lengths', () => {
    const key = 'a'.repeat(32);
    mockConfig.API_KEY = key;
    const next = jest.fn();
    const res = createMockRes();
    apiKeyAuth(createMockReq({ 'x-api-key': 'short' }) as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
