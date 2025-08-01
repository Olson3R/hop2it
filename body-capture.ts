import { IncomingMessage, ServerResponse } from 'http';
import { Transform } from 'stream';

export class BodyCapture {
  static captureRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxSize = 1024 * 1024; // 1MB limit

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        
        if (totalSize > maxSize) {
          resolve('[Request body too large - truncated]');
          return;
        }
        
        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve(body || '[Empty request body]');
        } catch (error) {
          resolve('[Binary request body - not displayable]');
        }
      });

      req.on('error', (error) => {
        reject(error);
      });

      // If no data is received within a reasonable time, resolve with empty
      setTimeout(() => {
        if (chunks.length === 0) {
          resolve('[Empty request body]');
        }
      }, 100);
    });
  }

  static createResponseCapture(): {
    captureStream: Transform;
    getBody: () => Promise<string>;
  } {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const maxSize = 1024 * 1024; // 1MB limit

    const captureStream = new Transform({
      transform(chunk: Buffer, encoding, callback) {
        totalSize += chunk.length;
        
        if (totalSize <= maxSize) {
          chunks.push(chunk);
        }
        
        // Pass through the chunk unchanged
        callback(null, chunk);
      }
    });

    const getBody = (): Promise<string> => {
      return new Promise((resolve) => {
        try {
          if (totalSize > maxSize) {
            resolve('[Response body too large - truncated]');
            return;
          }

          if (chunks.length === 0) {
            resolve('[Empty response body]');
            return;
          }

          const body = Buffer.concat(chunks).toString('utf8');
          resolve(body || '[Empty response body]');
        } catch (error) {
          resolve('[Binary response body - not displayable]');
        }
      });
    };

    return { captureStream, getBody };
  }

  static shouldLogBody(contentType?: string): boolean {
    if (!contentType) return true;
    
    const textTypes = [
      'application/json',
      'application/xml',
      'text/',
      'application/x-www-form-urlencoded',
      'application/graphql'
    ];

    return textTypes.some(type => contentType.toLowerCase().includes(type));
  }

  static formatBody(body: string, contentType?: string, maxLength: number = 500): string {
    if (!body || body.length === 0) {
      return '[Empty body]';
    }

    // Try to format JSON
    if (contentType?.includes('application/json')) {
      try {
        const parsed = JSON.parse(body);
        const formatted = JSON.stringify(parsed, null, 2);
        
        if (formatted.length > maxLength) {
          return formatted.substring(0, maxLength) + '\n... [truncated]';
        }
        
        return formatted;
      } catch {
        // Fall through to regular formatting
      }
    }

    // Truncate if too long
    if (body.length > maxLength) {
      return body.substring(0, maxLength) + '... [truncated]';
    }

    return body;
  }

  static formatHeaders(headers: Record<string, string | string[]>): string {
    const formatted: string[] = [];
    
    for (const [key, value] of Object.entries(headers)) {
      const headerValue = Array.isArray(value) ? value.join(', ') : value;
      formatted.push(`  ${key}: ${headerValue}`);
    }

    return formatted.join('\n');
  }

  static sanitizeHeaders(headers: Record<string, string | string[]>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-access-token',
      'proxy-authorization'
    ];

    for (const [key, value] of Object.entries(headers)) {
      const headerValue = Array.isArray(value) ? value.join(', ') : value;
      const isSensitive = sensitiveHeaders.some(sensitive => 
        key.toLowerCase().includes(sensitive)
      );
      
      sanitized[key] = isSensitive ? this.maskSensitiveValue(headerValue) : headerValue;
    }

    return sanitized;
  }

  static maskSensitiveValue(value: string): string {
    if (!value || value.length === 0) {
      return '[EMPTY]';
    }

    // Special handling for authorization headers
    const authPrefixes = ['bearer ', 'basic ', 'digest ', 'apikey ', 'token '];
    let prefix = '';
    let actualValue = value;
    
    for (const authPrefix of authPrefixes) {
      if (value.toLowerCase().startsWith(authPrefix)) {
        prefix = value.substring(0, authPrefix.length);
        actualValue = value.substring(authPrefix.length);
        break;
      }
    }

    if (actualValue.length === 0) {
      return prefix + '[EMPTY]';
    }

    // Calculate how much to show (1/4 of actualValue length, max 8 characters)
    const showLength = Math.min(Math.floor(actualValue.length / 4), 8);
    
    if (showLength === 0) {
      return prefix + '[REDACTED]';
    }

    const visiblePart = actualValue.substring(0, showLength);
    const maskedLength = actualValue.length - showLength;
    const mask = '*'.repeat(Math.min(maskedLength, 20)); // Limit mask display to 20 chars
    
    return `${prefix}${visiblePart}${mask}${maskedLength > 20 ? `...+${maskedLength - 20}` : ''}`;
  }
}