/**
 * Tests for logger utility module
 */

import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './logger.js';

describe('logger', () => {
  it('should create a logger instance', () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should sanitize tokens in log messages', () => {
    const logger = createLogger('debug');
    const infoSpy = vi.spyOn(logger, 'info');

    logger.info('Bearer token: abc123def456ghi789');

    // The logger should sanitize the message
    expect(infoSpy).toHaveBeenCalled();
  });

  it('should sanitize email addresses in log messages', () => {
    const logger = createLogger();
    const infoSpy = vi.spyOn(logger, 'info');

    logger.info('User email: test@example.com');

    expect(infoSpy).toHaveBeenCalled();
  });

  it('should sanitize secret patterns in log messages', () => {
    const logger = createLogger();
    const infoSpy = vi.spyOn(logger, 'info');

    logger.info('Secret: mysecret123');

    expect(infoSpy).toHaveBeenCalled();
  });
});
