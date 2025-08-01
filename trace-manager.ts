import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { RequestTrace } from './types';

export class TraceManager {
  private traces: Map<string, RequestTrace> = new Map();

  generateTraceId(): string {
    return randomUUID();
  }

  extractTraceId(req: IncomingMessage): string {
    const headers = req.headers;
    
    // Check common trace ID headers
    const traceHeaders = [
      'x-trace-id',
      'x-request-id', 
      'x-correlation-id',
      'traceparent',
      'x-amzn-trace-id'
    ];

    for (const header of traceHeaders) {
      const value = headers[header];
      if (value) {
        // Extract ID from traceparent format if needed
        if (header === 'traceparent' && typeof value === 'string') {
          const parts = value.split('-');
          if (parts.length >= 2) return parts[1];
        }
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return this.generateTraceId();
  }

  startTrace(req: IncomingMessage, requestBody?: string): RequestTrace {
    const traceId = this.extractTraceId(req);
    const url = req.url || '/';
    const domain = req.headers.host || 'unknown';

    const trace: RequestTrace = {
      id: traceId,
      timestamp: Date.now(),
      method: req.method || 'GET',
      url,
      headers: this.sanitizeHeaders(req.headers),
      domain: domain.split(':')[0], // Remove port
      requestBody
    };

    this.traces.set(traceId, trace);
    return trace;
  }

  updateTrace(traceId: string, updates: Partial<RequestTrace>): RequestTrace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;

    Object.assign(trace, updates);
    
    if (updates.statusCode !== undefined) {
      trace.duration = Date.now() - trace.timestamp;
    }

    return trace;
  }

  finishTrace(traceId: string, statusCode: number, error?: string, responseHeaders?: Record<string, string>, responseBody?: string): RequestTrace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;

    trace.statusCode = statusCode;
    trace.duration = Date.now() - trace.timestamp;
    if (error) trace.error = error;
    if (responseHeaders) trace.responseHeaders = responseHeaders;
    if (responseBody) trace.responseBody = responseBody;

    // Clean up old traces (keep for 1 minute)
    setTimeout(() => {
      this.traces.delete(traceId);
    }, 60000);

    return trace;
  }

  getTrace(traceId: string): RequestTrace | undefined {
    return this.traces.get(traceId);
  }

  private sanitizeHeaders(headers: IncomingMessage['headers']): Record<string, string> {
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
      if (value) {
        const headerValue = Array.isArray(value) ? value.join(', ') : value;
        const isSensitive = sensitiveHeaders.some(sensitive => 
          key.toLowerCase().includes(sensitive)
        );
        
        sanitized[key] = isSensitive 
          ? this.maskSensitiveValue(headerValue)
          : headerValue;
      }
    }

    return sanitized;
  }

  private maskSensitiveValue(value: string): string {
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

  cleanup(): void {
    this.traces.clear();
  }
}