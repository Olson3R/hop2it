import { createServer, IncomingMessage, ServerResponse } from 'http';
import httpProxy from 'http-proxy';
import { Transform } from 'stream';
import { URL } from 'url';
import { ConfigManager } from './config-manager';
import { Logger } from './logger';
import { TraceManager } from './trace-manager';
import { LogStreamer } from './log-streamer';
import { Colors } from './colors';
import { BodyCapture } from './body-capture';
import { ProxyConfig, RouteConfig } from './types';

export class ProxyServer {
  private server?: ReturnType<typeof createServer>;
  private configManager: ConfigManager;
  private logger: Logger;
  private traceManager: TraceManager;
  private logStreamer: LogStreamer;
  private config: ProxyConfig;

  constructor(configPath?: string, logFile?: string) {
    this.configManager = new ConfigManager(configPath);
    this.logger = new Logger();
    this.traceManager = new TraceManager();
    this.config = this.configManager.getConfig();
    
    // Set up log streamer with rotation config
    const rotationConfig = this.config.global.logRotation;
    this.logStreamer = new LogStreamer(8089, logFile, rotationConfig);

    // Connect logger to streamer
    this.logger.setStreamer(this.logStreamer);

    this.setupConfigListeners();
  }

  private setupConfigListeners(): void {
    this.configManager.on('config-loaded', (config: ProxyConfig) => {
      this.config = config;
      this.logger.setGlobalLevel(config.global.logging);
      this.updateDomainLogging();
    });

    this.configManager.on('config-changed', (config: ProxyConfig) => {
      this.config = config;
      this.logger.setGlobalLevel(config.global.logging);
      this.updateDomainLogging();
      this.logger.info(`${Colors.success()('Configuration reloaded')}`, 'SYSTEM');
    });

    this.configManager.on('config-error', (error: Error) => {
      this.logger.error('Configuration error', 'SYSTEM', undefined, { error: error.message });
    });
  }

  private updateDomainLogging(): void {
    for (const [domain, route] of Object.entries(this.config.routes)) {
      if (route.logging) {
        this.logger.setDomainLevel(domain, route.logging);
      }
    }
  }

  async start(): Promise<void> {
    await this.configManager.load();
    this.configManager.startWatching();

    // Start log streamer
    await this.logStreamer.start();


    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Handle WebSocket upgrade requests
    this.server.on('upgrade', (req, socket, head) => {
      this.handleWebSocketUpgrade(req, socket, head);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.global.port, async (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          await this.logger.info(`${Colors.logo()} ${Colors.success()('started')} on port ${Colors.highlight()(this.config.global.port.toString())}`, 'SYSTEM');
          await this.logger.info(`${Colors.highlight()('Log streaming')} available on port ${Colors.highlight()('8089')}`, 'SYSTEM');
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    this.configManager.stopWatching();
    this.traceManager.cleanup();
    
    if (this.server) {
      return new Promise((resolve, reject) => {
        // Set a timeout to force exit if server doesn't close cleanly
        const timeout = setTimeout(() => {
          reject(new Error('Server shutdown timeout'));
        }, 5000);
        
        this.server!.close(async (err) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
            return;
          }
          
          try {
            // Stop log streamer after server is closed
            await this.logStreamer.stop();
            await this.logger.info(`${Colors.logo()} ${Colors.warning()('stopped')}`, 'SYSTEM');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        
        // Force close any existing connections
        this.server!.closeAllConnections?.();
      });
    } else {
      // Stop log streamer even if no server
      await this.logStreamer.stop();
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let requestBody: string | undefined;
    
    // Capture request body if needed
    const domain = this.extractDomain(req);
    const route = this.findRoute(domain, req.url);
    
    const shouldCaptureRequestBody = route?.logRequestBody ?? this.config.global.logRequestBody ?? false;
    
    if (shouldCaptureRequestBody && req.method && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        requestBody = await BodyCapture.captureRequestBody(req);
      } catch (error) {
        // If body capture fails, continue without it
        requestBody = '[Failed to capture request body]';
      }
    }

    const trace = this.traceManager.startTrace(req, requestBody);
    
    try {
      if (!route) {
        await this.handleNotFound(req, res, trace, domain);
        return;
      }

      if (!route.enabled) {
        await this.handleDisabled(req, res, trace, domain);
        return;
      }

      trace.target = route.target;
      const originalUrl = req.url;
      
      if (this.config.global.tracing) {
        const method = Colors.httpMethod(req.method || 'GET')(req.method?.padEnd(6) || 'GET   ');
        const arrow = Colors.arrow();
        const target = Colors.target()(route.target);
        await this.logger.info(`${method} ${req.url} ${arrow} ${target}`, trace.id, domain);
      }

      await this.proxyRequest(req, res, route, trace, originalUrl);

    } catch (error) {
      await this.handleError(req, res, trace, error as Error);
    }
  }

  private extractDomain(req: IncomingMessage): string {
    const host = req.headers.host;
    if (!host) return 'unknown';
    
    // Remove port if present
    return host.split(':')[0];
  }

  private findRoute(domain: string, url?: string): RouteConfig | undefined {
    const candidates: { route: RouteConfig; score: number }[] = [];

    for (const [routeKey, route] of Object.entries(this.config.routes)) {
      let domainMatch = false;
      let score = 0;
      let routeDomain = routeKey;
      let routePath: string | undefined;

      // Check if route key contains path (domain:path syntax)
      if (routeKey.includes(':')) {
        const [domain_part, path_part] = routeKey.split(':', 2);
        routeDomain = domain_part;
        routePath = path_part;
      }

      // Domain matching
      if (routeDomain === domain) {
        domainMatch = true;
        score += 1000; // Exact domain match gets highest priority
      } else if (routeDomain.startsWith('*.')) {
        const baseDomain = routeDomain.substring(2);
        if (domain.endsWith(baseDomain)) {
          domainMatch = true;
          score += 500; // Wildcard match gets medium priority
        }
      }

      if (!domainMatch) continue;

      // Path matching - check both route config path and route key path
      const pathToMatch = routePath || route.path;
      if (pathToMatch && url) {
        if (url.startsWith(pathToMatch)) {
          score += pathToMatch.length; // Longer path matches get higher score
          candidates.push({ route, score });
        } else {
          // Domain matches but path doesn't, skip this route
          continue;
        }
      } else if (!pathToMatch) {
        // No path specified, matches any path
        candidates.push({ route, score });
      }
    }

    // Return the route with the highest score (most specific match)
    if (candidates.length === 0) return undefined;
    
    candidates.sort((a, b) => b.score - a.score);
    
    // Debug logging to help troubleshoot routing issues
    if (this.config.global.logging === 'debug' && candidates.length > 1) {
      console.log(`Multiple route candidates for ${domain}${url}:`);
      candidates.forEach((candidate, index) => {
        console.log(`  ${index + 1}. score=${candidate.score}, target=${candidate.route.target}`);
      });
      console.log(`Selected: ${candidates[0].route.target}`);
    }
    
    return candidates[0].route;
  }

  private async proxyRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    route: RouteConfig, 
    trace: any,
    originalUrl?: string
  ): Promise<void> {
    // Handle path replacement if specified
    let finalUrl = req.url;
    if (route.path && route.pathReplace !== undefined && req.url) {
      if (req.url.startsWith(route.path)) {
        finalUrl = route.pathReplace + req.url.substring(route.path.length);
        req.url = finalUrl;
      }
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        const targetUrl = new URL(route.target);
        
        // Log the final proxied path if it was changed
        if (this.config.global.tracing && originalUrl && finalUrl !== originalUrl) {
          const pathInfo = Colors.highlight()(`${originalUrl} → ${finalUrl}`);
          await this.logger.info(`Path rewritten: ${pathInfo}`, trace.id, trace.domain);
        }
        
        const proxy = httpProxy.createProxyServer({
          target: route.target,
          changeOrigin: true,
          secure: false, // Allow self-signed certificates
          timeout: 30000,
          xfwd: true, // Pass along original headers including x-forwarded-*
        });

        // Add trace ID and x-forwarded-host headers
        req.headers['x-trace-id'] = trace.id;
        req.headers['x-forwarded-host'] = req.headers.host || 'unknown';

        // Set up response capture if needed
        const shouldCaptureResponseHeaders = route.logResponseHeaders ?? this.config.global.logResponseHeaders ?? false;
        const shouldCaptureResponseBody = route.logResponseBody ?? this.config.global.logResponseBody ?? false;
        
        let responseHeaders: Record<string, string> | undefined;
        let responseBodyCapture: { captureStream: Transform; getBody: () => Promise<string> } | undefined;

        proxy.on('proxyRes', async (proxyRes: any, proxyReq: any, proxyResRes: any) => {
          const statusCode = proxyRes.statusCode || 200;
          
          // Capture response headers
          if (shouldCaptureResponseHeaders) {
            responseHeaders = BodyCapture.sanitizeHeaders(proxyRes.headers);
          }
          
          // Set up response body capture
          if (shouldCaptureResponseBody) {
            const contentType = proxyRes.headers['content-type'] as string;
            if (BodyCapture.shouldLogBody(contentType)) {
              responseBodyCapture = BodyCapture.createResponseCapture();
              proxyRes.pipe(responseBodyCapture.captureStream);
              responseBodyCapture.captureStream.pipe(proxyResRes);
            }
          }
          
          // Wait for response to complete before logging
          proxyRes.on('end', async () => {
            let responseBody: string | undefined;
            if (responseBodyCapture) {
              try {
                responseBody = await responseBodyCapture.getBody();
              } catch (error) {
                responseBody = '[Failed to capture response body]';
              }
            }
            
            this.traceManager.finishTrace(trace.id, statusCode, undefined, responseHeaders, responseBody);
            
            if (this.config.global.tracing) {
              await this.logger.logRequest({
                ...trace,
                statusCode,
                duration: Date.now() - trace.timestamp,
                responseHeaders,
                responseBody
              }, route, this.config.global);
            }
            
            resolve();
          });
        });

        proxy.on('error', async (error: any) => {
          this.traceManager.finishTrace(trace.id, 500, error.message);
          
          await this.logger.error('Proxy error', trace.id, trace.domain, {
            error: error.message,
            target: route.target
          });
          
          reject(error);
        });

        proxy.web(req, res);

      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleWebSocketUpgrade(req: any, socket: any, head: any): Promise<void> {
    const domain = this.extractDomain(req);
    const route = this.findRoute(domain, req.url);
    
    if (!route) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!route.enabled) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    const trace = this.traceManager.startTrace(req);
    trace.target = route.target;
    
    // Handle path replacement for WebSocket URLs
    const originalUrl = req.url;
    if (route.path && route.pathReplace !== undefined && req.url) {
      if (req.url.startsWith(route.path)) {
        req.url = route.pathReplace + req.url.substring(route.path.length);
      }
    }

    if (this.config.global.tracing) {
      const wsIcon = Colors.highlight()('🔌');
      const arrow = Colors.arrow();
      const target = Colors.target()(route.target);
      await this.logger.info(`${wsIcon} WebSocket ${originalUrl} ${arrow} ${target}`, trace.id, domain);
      
      if (originalUrl !== req.url) {
        const pathInfo = Colors.highlight()(`${originalUrl} → ${req.url}`);
        await this.logger.info(`WebSocket path rewritten: ${pathInfo}`, trace.id, domain);
      }
    }

    try {
      const proxy = httpProxy.createProxyServer({
        target: route.target,
        ws: true,
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        xfwd: true,
      });

      // Add trace ID to headers
      req.headers['x-trace-id'] = trace.id;
      req.headers['x-forwarded-host'] = req.headers.host || 'unknown';

      proxy.on('error', async (error: any) => {
        this.traceManager.finishTrace(trace.id, 500, error.message);
        await this.logger.error('WebSocket proxy error', trace.id, domain, {
          error: error.message,
          target: route.target
        });
        socket.destroy();
      });

      proxy.on('open', async () => {
        await this.logger.info('WebSocket connection established', trace.id, domain);
      });

      proxy.on('close', async () => {
        this.traceManager.finishTrace(trace.id, 200);
        await this.logger.info('WebSocket connection closed', trace.id, domain);
      });

      proxy.ws(req, socket, head);

    } catch (error) {
      this.traceManager.finishTrace(trace.id, 500, (error as Error).message);
      await this.logger.error('WebSocket handling error', trace.id, domain, {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      socket.destroy();
    }
  }

  private async handleNotFound(req: IncomingMessage, res: ServerResponse, trace: any, domain: string): Promise<void> {
    const statusCode = 404;
    this.traceManager.finishTrace(trace.id, statusCode, 'No route configured');
    
    const method = Colors.httpMethod(req.method || 'GET')(req.method?.padEnd(6) || 'GET   ');
    await this.logger.warn(`${Colors.warning()('No route found:')} ${method} ${req.url}`, trace.id, domain);

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'No route configured',
      domain,
      traceId: trace.id,
      availableRoutes: Object.keys(this.config.routes)
    }, null, 2));
  }

  private async handleDisabled(req: IncomingMessage, res: ServerResponse, trace: any, domain: string): Promise<void> {
    const statusCode = 503;
    this.traceManager.finishTrace(trace.id, statusCode, 'Route disabled');
    
    await this.logger.info(`${Colors.warning()('Route disabled:')} ${Colors.domain(domain)(domain)}`, trace.id, domain);

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Route disabled',
      domain,
      traceId: trace.id
    }, null, 2));
  }

  private async handleError(req: IncomingMessage, res: ServerResponse, trace: any, error: Error): Promise<void> {
    const statusCode = 500;
    this.traceManager.finishTrace(trace.id, statusCode, error.message);
    
    await this.logger.error('Request handling error', trace.id, trace.domain, {
      error: error.message,
      stack: error.stack
    });

    if (!res.headersSent) {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal server error',
        traceId: trace.id,
        message: error.message
      }, null, 2));
    }
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }
}