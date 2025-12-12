/**
 * Tests for session verification middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type Request, type Response } from 'express';
import { verifySession, type AuthenticatedRequest } from './session-verify.js';
import * as appConfig from '../config/app-config.js';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('../config/app-config.js');
vi.mock('../utils/logger.js');

describe('verifySession middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(appConfig.getAppConfigSync).mockReturnValue({
      session: {
        signingKey: 'test-signing-key',
      },
    } as any);

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    nextFunction = vi.fn();
  });

  it('should verify valid session token and call next', () => {
    const payload = { sub: 'test-user-id', iat: Math.floor(Date.now() / 1000) };
    const token = jwt.sign(payload, 'test-signing-key', { algorithm: 'HS256' });

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.sub).toBe('test-user-id');
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is missing', () => {
    mockRequest.headers = {};

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  });

  it('should return 401 when Authorization header does not start with Bearer', () => {
    mockRequest.headers = {
      authorization: 'Invalid token',
    };

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  });

  it('should return 401 when token is missing', () => {
    mockRequest.headers = {
      authorization: 'Bearer ',
    };

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing token',
    });
  });

  it('should return 401 when token is invalid', () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token',
    };

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
  });

  it('should return 401 when token is expired', () => {
    const payload = {
      sub: 'test-user-id',
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    };
    const token = jwt.sign(payload, 'test-signing-key', { algorithm: 'HS256' });

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
  });

  it('should return 401 when token is signed with wrong key', () => {
    const payload = { sub: 'test-user-id' };
    const token = jwt.sign(payload, 'wrong-signing-key', { algorithm: 'HS256' });

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    verifySession(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired session token',
    });
  });
});
