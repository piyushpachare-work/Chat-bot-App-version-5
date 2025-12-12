/**
 * Logger utility module
 * Ensures secrets, tokens, and PII are never logged
 */

import winston from 'winston';

/**
 * Redacts sensitive information from log messages
 * @param message - The message to sanitize
 * @returns Sanitized message with sensitive data redacted
 */
function sanitizeMessage(message: string): string {
  // Pattern for tokens (Bearer tokens, JWT, etc.)
  const tokenPattern = /(Bearer\s+)?[A-Za-z0-9_-]{20,}/g;
  
  // Pattern for email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  
  // Pattern for common secret patterns
  const secretPattern = /(secret|password|token|key|credential)[=:]\s*[^\s,}]+/gi;

  let sanitized = message;

  // Replace tokens
  sanitized = sanitized.replace(tokenPattern, (match) => {
    if (match.startsWith('Bearer ')) {
      return 'Bearer [REDACTED]';
    }
    return '[REDACTED]';
  });

  // Replace email addresses
  sanitized = sanitized.replace(emailPattern, '[EMAIL_REDACTED]');

  // Replace secret patterns
  sanitized = sanitized.replace(secretPattern, (match) => {
    const parts = match.split(/[=:]/);
    if (parts.length >= 2) {
      return `${parts[0]}=[REDACTED]`;
    }
    return match;
  });

  return sanitized;
}

/**
 * Custom formatter that sanitizes log messages
 */
const sanitizeFormatter = winston.format((info) => {
  if (info.message) {
    info.message = sanitizeMessage(String(info.message));
  }
  if (info.metadata) {
    const sanitizedMetadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(info.metadata)) {
      if (typeof value === 'string') {
        sanitizedMetadata[key] = sanitizeMessage(value);
      } else {
        sanitizedMetadata[key] = value;
      }
    }
    info.metadata = sanitizedMetadata;
  }
  return info;
});

/**
 * Pulls requestId up to top-level log fields when present in metadata.
 */
const requestIdFormatter = winston.format((info) => {
  const requestId =
    (info.requestId as string | undefined) ||
    ((info.metadata as Record<string, unknown> | undefined)?.requestId as string | undefined);

  if (requestId) {
    info.requestId = requestId;
    info.metadata = {
      ...(info.metadata as Record<string, unknown> | undefined),
      requestId,
    };
  }

  return info;
});

/**
 * Creates and configures the Winston logger instance
 * @param level - Log level (default: 'info')
 * @returns Configured Winston logger
 */
export function createLogger(level: string = 'info'): winston.Logger {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      requestIdFormatter(),
      sanitizeFormatter(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'chatbot-app' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });
}
