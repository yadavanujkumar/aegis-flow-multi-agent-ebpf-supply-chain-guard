import { Request, Response, NextFunction } from 'express';
import { validateBody } from '../src/middleware/validate';
import { DetonationRequestSchema } from '../src/domain/Events';

jest.mock('../src/infrastructure/Logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createMockReq(body: unknown): Partial<Request> {
  return { body, path: '/api/webhook/cicd' };
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

describe('validateBody middleware', () => {
  const middleware = validateBody(DetonationRequestSchema);

  it('should call next() for a valid body', () => {
    const req = createMockReq({
      repository: 'owner/repo',
      commit: 'abc1234',
      dependencyFile: 'package.json',
    });
    const res = createMockRes();
    const next = jest.fn();
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('should return 422 when body is empty', () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = jest.fn();
    middleware(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
    expect((res.body as any).error).toBe('Validation Error');
  });

  it('should return 422 when commit is not a valid SHA', () => {
    const req = createMockReq({
      repository: 'owner/repo',
      commit: 'NOT-A-SHA!',
      dependencyFile: 'package.json',
    });
    const res = createMockRes();
    const next = jest.fn();
    middleware(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
  });

  it('should strip unknown fields and pass validated data', () => {
    const req = createMockReq({
      repository: 'owner/repo',
      commit: 'abc1234',
      dependencyFile: 'package.json',
      extraField: 'should be stripped',
    });
    const res = createMockRes();
    const next = jest.fn();
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).body.extraField).toBeUndefined();
  });
});
