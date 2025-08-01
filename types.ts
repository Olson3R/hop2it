export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

export interface RouteConfig {
  target: string;
  path?: string; // Optional path pattern to match
  pathReplace?: string; // Optional replacement for the matched path
  logging?: LogLevel;
  enabled?: boolean;
  logRequestHeaders?: boolean;
  logRequestBody?: boolean;
  logResponseHeaders?: boolean;
  logResponseBody?: boolean;
}

export interface LogRotationConfig {
  maxFileSize?: number; // bytes, default 10MB
  maxFiles?: number;    // default 5 files
  compress?: boolean;   // default false
}

export interface ProxyConfig {
  routes: Record<string, RouteConfig>;
  global: {
    port: number;
    logging: LogLevel;
    tracing: boolean;
    configFile?: string;
    logFile?: string;
    logRequestHeaders?: boolean;
    logRequestBody?: boolean;
    logResponseHeaders?: boolean;
    logResponseBody?: boolean;
    logRotation?: LogRotationConfig;
  };
}

export interface RequestTrace {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  domain: string;
  target?: string;
  duration?: number;
  statusCode?: number;
  error?: string;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  traceId: string;
  message: string;
  domain?: string;
  data?: any;
}

export interface LogStreamOptions {
  level?: LogLevel;
  domain?: string;
  format?: 'json' | 'pretty';
  follow?: boolean;
}