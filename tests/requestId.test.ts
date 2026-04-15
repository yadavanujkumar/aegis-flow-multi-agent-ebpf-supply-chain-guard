import { Request, Response } from 'express';
import { requestId } from '../src/middleware/requestId';

function createMockReq(headers: Record<string, string | undefined> = {}): Partial<Request> {
  return { headers };
}

function createMockRes(): Partial<Response> & { _headers: Record<string, string> } {
  const res: Partial<Response> & { _headers: Record<string, string> } = {
    _headers: {},
    setHeader(name: string, value: string | number | readonly string[]) {
      res._headers[name as string] = String(value);
      return res as Response;
    },
  };
  return res;
}

describe('requestId middleware', () => {
  it('should generate a UUID when no X-Request-Id header is provided', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();
    requestId(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    const id = req.headers!['x-request-id'];
    expect(id).toBeDefined();
    // UUID v4 pattern
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(res._headers['X-Request-Id']).toBe(id);
  });

  it('should reuse X-Request-Id from the incoming request', () => {
    const existingId = 'my-custom-correlation-id';
    const req = createMockReq({ 'x-request-id': existingId });
    const res = createMockRes();
    const next = jest.fn();
    requestId(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(req.headers!['x-request-id']).toBe(existingId);
    expect(res._headers['X-Request-Id']).toBe(existingId);
  });
});
