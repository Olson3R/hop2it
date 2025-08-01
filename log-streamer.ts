import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { promises as fs } from 'fs';
import { LogEntry, LogLevel, LogStreamOptions, LogRotationConfig } from './types';
import { Colors } from './colors';
import { LogRotation } from './log-rotation';

export class LogStreamer extends EventEmitter {
  private wsServer?: WebSocketServer;
  private httpServer?: Server;
  private clients: Set<WebSocket> = new Set();
  private logFile?: string;
  private logRotation?: LogRotation;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(private wsPort: number = 8089, logFile?: string, rotationConfig?: LogRotationConfig) {
    super();
    this.logFile = logFile;
    
    if (logFile && rotationConfig) {
      this.logRotation = new LogRotation(logFile, {
        maxFileSize: rotationConfig.maxFileSize || 10 * 1024 * 1024,
        maxFiles: rotationConfig.maxFiles || 5,
        compress: rotationConfig.compress || false
      });
    }
  }

  async start(): Promise<void> {
    // Initialize log rotation if configured
    if (this.logRotation) {
      await this.logRotation.initialize();
    }
    
    // Create HTTP server for WebSocket upgrade
    this.httpServer = createServer();
    
    // Create WebSocket server
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: '/logs'
    });

    this.wsServer.on('connection', (ws, req) => {
      this.clients.add(ws);
      
      // Parse query parameters for filtering
      const url = new URL(req.url!, `http://localhost:${this.wsPort}`);
      const options: LogStreamOptions = {
        level: url.searchParams.get('level') as LogLevel || undefined,
        domain: url.searchParams.get('domain') || undefined,
        format: url.searchParams.get('format') as 'json' | 'pretty' || 'pretty',
        follow: url.searchParams.get('follow') !== 'false'
      };

      // Send existing log buffer if requested
      if (url.searchParams.get('history') === 'true') {
        this.sendLogHistory(ws, options);
      }

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Store options on the WebSocket for filtering
      (ws as any).streamOptions = options;
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(this.wsPort, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    if (this.logRotation) {
      await this.logRotation.close();
    }
    
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }
  }

  async streamLog(entry: LogEntry): Promise<void> {
    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Write to file if configured
    if (this.logFile) {
      await this.writeToFile(entry);
    }

    // Send to WebSocket clients
    this.broadcastToClients(entry);
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile) return;

    try {
      const logLine = JSON.stringify(entry) + '\n';
      
      if (this.logRotation) {
        await this.logRotation.write(logLine);
      } else {
        await fs.appendFile(this.logFile, logLine);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private broadcastToClients(entry: LogEntry): void {
    const deadClients: WebSocket[] = [];

    for (const client of this.clients) {
      if (client.readyState !== WebSocket.OPEN) {
        deadClients.push(client);
        continue;
      }

      const options: LogStreamOptions = (client as any).streamOptions || {};
      
      if (!this.shouldIncludeLog(entry, options)) {
        continue;
      }

      try {
        const message = this.formatLogForClient(entry, options);
        client.send(message);
      } catch (error) {
        console.error('Failed to send log to client:', error);
        deadClients.push(client);
      }
    }

    // Clean up dead clients
    deadClients.forEach(client => this.clients.delete(client));
  }

  private shouldIncludeLog(entry: LogEntry, options: LogStreamOptions): boolean {
    // Filter by level
    if (options.level) {
      const levels = ['error', 'warn', 'info', 'debug'];
      const entryIndex = levels.indexOf(entry.level);
      const filterIndex = levels.indexOf(options.level);
      
      if (entryIndex > filterIndex) {
        return false;
      }
    }

    // Filter by domain
    if (options.domain && entry.domain !== options.domain) {
      return false;
    }

    return true;
  }

  private formatLogForClient(entry: LogEntry, options: LogStreamOptions): string {
    if (options.format === 'json') {
      return JSON.stringify(entry);
    }

    // Pretty format with colors (colors will be stripped by terminals that don't support them)
    const timestamp = Colors.formatTimestamp(entry.timestamp);
    const level = Colors.logLevel(entry.level)(entry.level.toUpperCase().padEnd(5));
    const traceId = Colors.traceId(entry.traceId)(`[${entry.traceId.substring(0, 8)}]`);
    const domain = entry.domain ? Colors.domain(entry.domain)(`[${entry.domain}]`) : '';
    
    let message = `${timestamp} ${level} ${traceId} ${domain} ${entry.message}`;
    
    if (entry.data) {
      const dataStr = JSON.stringify(entry.data);
      message += ` ${Colors.muted()(dataStr)}`;
    }
    
    return message;
  }

  private sendLogHistory(ws: WebSocket, options: LogStreamOptions): void {
    const filteredLogs = this.logBuffer.filter(entry => 
      this.shouldIncludeLog(entry, options)
    );

    for (const entry of filteredLogs) {
      try {
        const message = this.formatLogForClient(entry, options);
        ws.send(message);
      } catch (error) {
        console.error('Failed to send log history:', error);
        break;
      }
    }
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  getLogRotationStatus(): { currentSize: string; maxSize: string; currentFile: string } | null {
    return this.logRotation ? this.logRotation.getStatus() : null;
  }

  async getLogHistory(options: LogStreamOptions = {}): Promise<LogEntry[]> {
    if (this.logFile) {
      try {
        const content = await fs.readFile(this.logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        const entries = lines.map(line => JSON.parse(line) as LogEntry);
        
        return entries.filter(entry => this.shouldIncludeLog(entry, options));
      } catch (error) {
        console.error('Failed to read log file:', error);
      }
    }

    return this.logBuffer.filter(entry => this.shouldIncludeLog(entry, options));
  }
}