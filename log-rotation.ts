import { promises as fs } from 'fs';
import { createWriteStream, WriteStream } from 'fs';
import { join, dirname } from 'path';

export interface LogRotationConfig {
  maxFileSize: number; // bytes
  maxFiles: number;
  compress?: boolean;
}

export class LogRotation {
  private logPath: string;
  private config: LogRotationConfig;
  private writeStream?: WriteStream;
  private currentSize: number = 0;

  constructor(logPath: string, config: LogRotationConfig) {
    this.logPath = logPath;
    this.config = {
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // Default 10MB
      maxFiles: config.maxFiles || 5, // Default 5 files
      compress: config.compress || false
    };
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(dirname(this.logPath), { recursive: true });
    
    // Get current file size if it exists
    try {
      const stats = await fs.stat(this.logPath);
      this.currentSize = stats.size;
    } catch {
      this.currentSize = 0;
    }

    // Create write stream
    this.writeStream = createWriteStream(this.logPath, { flags: 'a' });
  }

  async write(data: string): Promise<void> {
    if (!this.writeStream) {
      await this.initialize();
    }

    const dataSize = Buffer.byteLength(data, 'utf8');
    
    // Check if rotation is needed
    if (this.currentSize + dataSize > this.config.maxFileSize) {
      await this.rotate();
    }

    this.writeStream!.write(data);
    this.currentSize += dataSize;
  }

  private async rotate(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
    }

    // Rotate existing files
    await this.rotateFiles();

    // Create new write stream
    this.writeStream = createWriteStream(this.logPath, { flags: 'w' });
    this.currentSize = 0;
  }

  private async rotateFiles(): Promise<void> {
    const baseName = this.logPath;
    
    // Remove oldest file if max files reached
    const oldestFile = `${baseName}.${this.config.maxFiles}`;
    try {
      await fs.unlink(oldestFile);
    } catch {
      // File doesn't exist, that's fine
    }

    // Rotate numbered files
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const currentFile = i === 1 ? baseName : `${baseName}.${i}`;
      const nextFile = `${baseName}.${i + 1}`;
      
      try {
        await fs.rename(currentFile, nextFile);
      } catch {
        // File doesn't exist, continue
      }
    }

    // Optionally compress rotated files
    if (this.config.compress) {
      await this.compressRotatedFiles();
    }
  }

  private async compressRotatedFiles(): Promise<void> {
    // This would implement gzip compression of rotated files
    // For now, we'll leave this as a placeholder
    // Implementation would use zlib to compress .1, .2, etc. files
  }

  async close(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = undefined;
    }
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getStatus(): { currentSize: string; maxSize: string; currentFile: string } {
    return {
      currentSize: LogRotation.formatBytes(this.currentSize),
      maxSize: LogRotation.formatBytes(this.config.maxFileSize),
      currentFile: this.logPath
    };
  }
}