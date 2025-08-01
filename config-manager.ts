import { promises as fs } from 'fs';
import { watch } from 'fs';
import { EventEmitter } from 'events';
import { join } from 'path';
import { homedir } from 'os';
import { ProxyConfig } from './types';

export class ConfigManager extends EventEmitter {
  private config: ProxyConfig;
  private configPath: string;
  private watcher?: ReturnType<typeof watch>;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || join(homedir(), '.hop2it', 'proxy-config.json');
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): ProxyConfig {
    return {
      routes: {},
      global: {
        port: 8080,
        logging: 'info',
        tracing: true,
        configFile: this.configPath,
        logRequestHeaders: false,
        logRequestBody: false,
        logResponseHeaders: false,
        logResponseBody: false,
        logRotation: {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          compress: false
        }
      }
    };
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...this.getDefaultConfig(), ...JSON.parse(data) };
      this.emit('config-loaded', this.config);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.ensureConfigDir();
        await this.save();
      } else {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    await this.ensureConfigDir();
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  private async ensureConfigDir(): Promise<void> {
    const configDir = join(homedir(), '.hop2it');
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }
  }

  startWatching(): void {
    this.watcher = watch(this.configPath, async (eventType) => {
      if (eventType === 'change') {
        try {
          await this.load();
          this.emit('config-changed', this.config);
        } catch (error) {
          this.emit('config-error', error);
        }
      }
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  async addRoute(domain: string, target: string, additionalConfig?: Partial<import('./types').RouteConfig>): Promise<void> {
    this.config.routes[domain] = { 
      target, 
      logging: this.config.global.logging,
      enabled: true,
      ...additionalConfig
    };
    await this.save();
    this.emit('route-added', domain, this.config.routes[domain]);
  }

  async removeRoute(domain: string): Promise<void> {
    delete this.config.routes[domain];
    await this.save();
    this.emit('route-removed', domain);
  }

  async updateRoute(domain: string, updates: Partial<ProxyConfig['routes'][string]>): Promise<void> {
    if (this.config.routes[domain]) {
      // Handle undefined values by removing properties
      const updatedRoute = { ...this.config.routes[domain] };
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          delete (updatedRoute as any)[key];
        } else {
          (updatedRoute as any)[key] = value;
        }
      }
      this.config.routes[domain] = updatedRoute;
      await this.save();
      this.emit('route-updated', domain, this.config.routes[domain]);
    }
  }

  getRoute(domain: string): ProxyConfig['routes'][string] | undefined {
    return this.config.routes[domain];
  }

  listRoutes(): Record<string, ProxyConfig['routes'][string]> {
    return { ...this.config.routes };
  }
}