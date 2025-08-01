import chalk from 'chalk';
import { LogLevel } from './types';

export class Colors {
  // Log level colors
  static logLevel(level: LogLevel): chalk.Chalk {
    switch (level) {
      case 'error': return chalk.red.bold;
      case 'warn': return chalk.yellow.bold;
      case 'info': return chalk.blue.bold;
      case 'debug': return chalk.gray.bold;
      default: return chalk.white.bold;
    }
  }

  // HTTP status code colors
  static statusCode(code: number): chalk.Chalk {
    if (code >= 200 && code < 300) return chalk.green.bold;      // Success
    if (code >= 300 && code < 400) return chalk.cyan.bold;       // Redirect
    if (code >= 400 && code < 500) return chalk.yellow.bold;     // Client Error
    if (code >= 500) return chalk.red.bold;                      // Server Error
    return chalk.white.bold;                                     // Unknown
  }

  // HTTP method colors
  static httpMethod(method: string): chalk.Chalk {
    switch (method.toUpperCase()) {
      case 'GET': return chalk.green;
      case 'POST': return chalk.blue;
      case 'PUT': return chalk.yellow;
      case 'PATCH': return chalk.magenta;
      case 'DELETE': return chalk.red;
      case 'HEAD': return chalk.gray;
      case 'OPTIONS': return chalk.cyan;
      default: return chalk.white;
    }
  }

  // Domain colors (rotating colors for different domains)
  static domain(domain: string): chalk.Chalk {
    const hash = this.hashCode(domain);
    const colors = [
      chalk.cyan,
      chalk.magenta,
      chalk.yellow,
      chalk.green,
      chalk.blue,
      chalk.red
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  // Route status colors
  static routeStatus(enabled: boolean): chalk.Chalk {
    return enabled ? chalk.green : chalk.red;
  }

  // Duration colors (based on response time)
  static duration(ms: number): chalk.Chalk {
    if (ms < 100) return chalk.green;        // Fast
    if (ms < 500) return chalk.yellow;       // Medium
    if (ms < 1000) return chalk.magenta;     // Slow
    return chalk.red;                        // Very slow
  }

  // Trace ID colors (consistent per trace)
  static traceId(traceId: string): chalk.Chalk {
    const hash = this.hashCode(traceId);
    const colors = [
      chalk.cyan.dim,
      chalk.magenta.dim,
      chalk.yellow.dim,
      chalk.green.dim,
      chalk.blue.dim,
      chalk.red.dim
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  // Target URL colors
  static target(): chalk.Chalk {
    return chalk.gray;
  }

  // Timestamp colors
  static timestamp(): chalk.Chalk {
    return chalk.gray.dim;
  }

  // Success/error indicators
  static success(): chalk.Chalk {
    return chalk.green.bold;
  }

  static error(): chalk.Chalk {
    return chalk.red.bold;
  }

  static warning(): chalk.Chalk {
    return chalk.yellow.bold;
  }

  // Special formatting
  static highlight(): chalk.Chalk {
    return chalk.cyan.bold;
  }

  static muted(): chalk.Chalk {
    return chalk.gray;
  }

  static bold(): chalk.Chalk {
    return chalk.white.bold;
  }

  // Utility function to hash strings for consistent coloring
  private static hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Format helpers
  static formatTimestamp(timestamp: number = Date.now()): string {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return this.timestamp()(`${time}.${ms}`);
  }

  static formatDuration(ms: number): string {
    const color = this.duration(ms);
    if (ms < 1000) {
      return color(`${ms}ms`);
    } else {
      return color(`${(ms / 1000).toFixed(2)}s`);
    }
  }

  // Box drawing and separators
  static separator(): string {
    return chalk.gray('│');
  }

  static bullet(): string {
    return chalk.gray('•');
  }

  static arrow(): string {
    return chalk.gray('→');
  }

  // Status indicators
  static statusIcon(enabled: boolean): string {
    return enabled ? chalk.green('✓') : chalk.red('✗');
  }

  static loadingSpinner(frame: number): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    return chalk.cyan(frames[frame % frames.length]);
  }

  // Logo/branding
  static logo(): string {
    return chalk.cyan.bold('🐰 hop2it');
  }
}