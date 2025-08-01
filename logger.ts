import { LogLevel, LogEntry, RequestTrace, RouteConfig, ProxyConfig } from './types';
import { LogStreamer } from './log-streamer';
import { Colors } from './colors';
import { BodyCapture } from './body-capture';

export class Logger {
  private globalLevel: LogLevel;
  private domainLevels: Map<string, LogLevel> = new Map();
  private streamer?: LogStreamer;

  constructor(globalLevel: LogLevel = 'info') {
    this.globalLevel = globalLevel;
  }

  setStreamer(streamer: LogStreamer): void {
    this.streamer = streamer;
  }

  setGlobalLevel(level: LogLevel): void {
    this.globalLevel = level;
  }

  setDomainLevel(domain: string, level: LogLevel): void {
    this.domainLevels.set(domain, level);
  }

  removeDomainLevel(domain: string): void {
    this.domainLevels.delete(domain);
  }

  private shouldLog(level: LogLevel, domain?: string): boolean {
    const targetLevel = domain && this.domainLevels.has(domain) 
      ? this.domainLevels.get(domain)! 
      : this.globalLevel;

    if (targetLevel === 'none') return false;

    const levels = ['error', 'warn', 'info', 'debug'];
    const targetIndex = levels.indexOf(targetLevel);
    const messageIndex = levels.indexOf(level);

    return messageIndex <= targetIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = Colors.formatTimestamp(entry.timestamp);
    const level = Colors.logLevel(entry.level)(entry.level.toUpperCase().padEnd(5));
    const traceId = Colors.traceId(entry.traceId)(`[${entry.traceId.substring(0, 8)}]`);
    const domain = entry.domain ? Colors.domain(entry.domain)(`[${entry.domain}]`) : '';
    
    let message = `${timestamp} ${level} ${traceId} ${domain} ${entry.message}`;
    
    if (entry.data) {
      const dataStr = JSON.stringify(entry.data, null, 0);
      message += ` ${Colors.muted()(dataStr)}`;
    }
    
    return message;
  }

  async log(level: LogLevel, message: string, traceId: string, domain?: string, data?: any): Promise<void> {
    if (!this.shouldLog(level, domain)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      traceId,
      message,
      domain,
      data
    };

    // Stream to connected clients
    if (this.streamer) {
      await this.streamer.streamLog(entry);
    }

    const formatted = this.formatLogEntry(entry);
    
    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  async logRequest(trace: RequestTrace, route?: RouteConfig, globalConfig?: ProxyConfig['global'], level: LogLevel = 'info'): Promise<void> {
    const domain = trace.domain;
    
    // Format the main request/response message with colors
    const method = Colors.httpMethod(trace.method)(trace.method.padEnd(6));
    const url = trace.url;
    const arrow = Colors.arrow();
    const target = Colors.target()(trace.target || 'NO_TARGET');
    
    let statusInfo = '';
    if (trace.statusCode !== undefined) {
      const statusColor = Colors.statusCode(trace.statusCode);
      statusInfo = ` ${statusColor(trace.statusCode.toString())}`;
    }
    
    let durationInfo = '';
    if (trace.duration !== undefined) {
      durationInfo = ` ${Colors.formatDuration(trace.duration)}`;
    }
    
    let errorInfo = '';
    if (trace.error) {
      errorInfo = ` ${Colors.error()('ERROR:')} ${trace.error}`;
    }
    
    const message = `${method} ${url} ${arrow} ${target}${statusInfo}${durationInfo}${errorInfo}`;
    
    await this.log(level, message, trace.id, domain);

    // Log additional details if enabled
    const shouldLogRequestHeaders = route?.logRequestHeaders ?? globalConfig?.logRequestHeaders ?? false;
    const shouldLogRequestBody = route?.logRequestBody ?? globalConfig?.logRequestBody ?? false;
    const shouldLogResponseHeaders = route?.logResponseHeaders ?? globalConfig?.logResponseHeaders ?? false;
    const shouldLogResponseBody = route?.logResponseBody ?? globalConfig?.logResponseBody ?? false;

    // Log request headers
    if (shouldLogRequestHeaders && trace.headers && Object.keys(trace.headers).length > 0) {
      const headersStr = BodyCapture.formatHeaders(trace.headers);
      await this.log(level, `${Colors.muted()('Request Headers:')}\n${Colors.muted()(headersStr)}`, trace.id, domain);
    }

    // Log request body
    if (shouldLogRequestBody && trace.requestBody) {
      const contentType = trace.headers['content-type'] || trace.headers['Content-Type'];
      const formattedBody = BodyCapture.formatBody(trace.requestBody, contentType);
      await this.log(level, `${Colors.muted()('Request Body:')}\n${Colors.muted()(formattedBody)}`, trace.id, domain);
    }

    // Log response headers
    if (shouldLogResponseHeaders && trace.responseHeaders && Object.keys(trace.responseHeaders).length > 0) {
      const headersStr = BodyCapture.formatHeaders(trace.responseHeaders);
      await this.log(level, `${Colors.muted()('Response Headers:')}\n${Colors.muted()(headersStr)}`, trace.id, domain);
    }

    // Log response body
    if (shouldLogResponseBody && trace.responseBody) {
      const contentType = trace.responseHeaders?.['content-type'] || trace.responseHeaders?.['Content-Type'];
      const formattedBody = BodyCapture.formatBody(trace.responseBody, contentType);
      await this.log(level, `${Colors.muted()('Response Body:')}\n${Colors.muted()(formattedBody)}`, trace.id, domain);
    }
  }

  async error(message: string, traceId: string, domain?: string, data?: any): Promise<void> {
    await this.log('error', message, traceId, domain, data);
  }

  async warn(message: string, traceId: string, domain?: string, data?: any): Promise<void> {
    await this.log('warn', message, traceId, domain, data);
  }

  async info(message: string, traceId: string, domain?: string, data?: any): Promise<void> {
    await this.log('info', message, traceId, domain, data);
  }

  async debug(message: string, traceId: string, domain?: string, data?: any): Promise<void> {
    await this.log('debug', message, traceId, domain, data);
  }
}