#!/usr/bin/env node
import { Command } from 'commander';
import { ConfigManager } from './config-manager';
import { ProxyServer } from './proxy-server';
import { ConfigTUI } from './config-tui';
import { Colors } from './colors';
import { LogLevel } from './types';
import { FirewallManager } from './firewall-manager';

const program = new Command();

program
  .name('proxy-server')
  .description('Local domain proxy server')
  .version('1.0.0');

program
  .command('start')
  .description('Start the proxy server')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-p, --port <number>', 'Server port', '8080')
  .option('-l, --log-file <path>', 'Log file path for persistent logging')
  .option('--log-max-size <size>', 'Maximum log file size in MB', '10')
  .option('--log-max-files <count>', 'Maximum number of log files to keep', '5')
  .action(async (options) => {
    try {
      // Load config first to apply CLI options
      const configManager = new ConfigManager(options.config);
      await configManager.load();
      const config = configManager.getConfig();
      
      // Override port if specified and persist it
      if (options.port) {
        config.global.port = parseInt(options.port);
        await configManager.save();
      }
      
      // Override log file if specified and persist it
      if (options.logFile) {
        config.global.logFile = options.logFile;
        await configManager.save();
      }
      
      // Override log rotation settings if specified
      if (options.logMaxSize || options.logMaxFiles) {
        if (!config.global.logRotation) {
          config.global.logRotation = {};
        }
        
        if (options.logMaxSize) {
          config.global.logRotation.maxFileSize = parseInt(options.logMaxSize) * 1024 * 1024; // Convert MB to bytes
        }
        
        if (options.logMaxFiles) {
          config.global.logRotation.maxFiles = parseInt(options.logMaxFiles);
        }
        
        await configManager.save();
      }

      const server = new ProxyServer(options.config, options.logFile);
      await server.start();
      
      // Handle graceful shutdown
      let isShuttingDown = false;
      const gracefulShutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        console.log(`\n${Colors.warning()(`Received ${signal}, shutting down proxy server...`)}`);
        try {
          await server.stop();
          console.log(Colors.success()('Server stopped cleanly'));
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('add')
  .description('Add a new route')
  .argument('<domain>', 'Domain to route')
  .argument('<target>', 'Target URL (e.g., http://localhost:3000)')
  .option('-l, --logging <level>', 'Logging level for this domain')
  .option('-p, --path <path>', 'Path pattern to match (e.g., /api)')
  .option('-r, --path-replace <replacement>', 'Path replacement (e.g., /v2 or "" for removal)')
  .option('--log-request-headers', 'Log request headers for this route')
  .option('--log-request-body', 'Log request body for this route')
  .option('--log-response-headers', 'Log response headers for this route')
  .option('--log-response-body', 'Log response body for this route')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (domain, target, options) => {
    try {
      const configManager = new ConfigManager(options.config);
      await configManager.load();
      
      // Create route config with body/header logging options
      const routeConfig: any = {
        target,
        enabled: true
      };
      
      // Add path options if provided
      if (options.path) {
        routeConfig.path = options.path;
      }
      
      if (options.pathReplace !== undefined) {
        routeConfig.pathReplace = options.pathReplace;
      }
      
      if (options.logging) routeConfig.logging = options.logging;
      if (options.logRequestHeaders) routeConfig.logRequestHeaders = true;
      if (options.logRequestBody) routeConfig.logRequestBody = true;
      if (options.logResponseHeaders) routeConfig.logResponseHeaders = true;
      if (options.logResponseBody) routeConfig.logResponseBody = true;
      
      configManager.getConfig().routes[domain] = routeConfig;
      await configManager.save();
      
      console.log(`${Colors.success()('Route added:')} ${Colors.domain(domain)(domain)} ${Colors.arrow()} ${Colors.target()(target)}`);
      
      // Show path configuration if provided
      if (routeConfig.path) {
        const pathReplace = routeConfig.pathReplace !== undefined ? ` → "${routeConfig.pathReplace}"` : '';
        console.log(`  ${Colors.highlight()('Path:')} ${routeConfig.path}${pathReplace}`);
      }
      
      // Show enabled logging options
      const logOptions = [];
      if (routeConfig.logRequestHeaders) logOptions.push('req-headers');
      if (routeConfig.logRequestBody) logOptions.push('req-body');
      if (routeConfig.logResponseHeaders) logOptions.push('res-headers');
      if (routeConfig.logResponseBody) logOptions.push('res-body');
      
      if (logOptions.length > 0) {
        console.log(`${Colors.muted()('Logging:')} ${logOptions.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to add route:', error);
      process.exit(1);
    }
  });

program
  .command('remove')
  .alias('rm')
  .description('Remove a route')
  .argument('<domain>', 'Domain to remove')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (domain, options) => {
    try {
      const configManager = new ConfigManager(options.config);
      await configManager.load();
      await configManager.removeRoute(domain);
      console.log(`${Colors.warning()('Route removed:')} ${Colors.domain(domain)(domain)}`);
    } catch (error) {
      console.error('Failed to remove route:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List all routes')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager(options.config);
      await configManager.load();
      const routes = configManager.listRoutes();
      
      if (Object.keys(routes).length === 0) {
        console.log(`${Colors.muted()('No routes configured')}`);
        return;
      }

      console.log(`${Colors.bold()('Configured routes:')}`);
      console.log(Colors.muted()('=================='));
      
      for (const [domain, route] of Object.entries(routes)) {
        const status = Colors.statusIcon(route.enabled || false);
        const domainColored = Colors.domain(domain)(domain);
        const arrow = Colors.arrow();
        const target = Colors.target()(route.target);
        const logging = route.logging || 'default';
        const loggingColored = Colors.logLevel(route.logging || 'info')(`(logging: ${logging})`);
        
        console.log(`${status} ${domainColored} ${arrow} ${target} ${loggingColored}`);
        
        // Show detailed logging options if enabled
        const logOptions = [];
        if (route.logRequestHeaders) logOptions.push('req-headers');
        if (route.logRequestBody) logOptions.push('req-body');
        if (route.logResponseHeaders) logOptions.push('res-headers');
        if (route.logResponseBody) logOptions.push('res-body');
        
        if (logOptions.length > 0) {
          console.log(`    ${Colors.muted()('└─ Detailed logging:')} ${Colors.muted()(logOptions.join(', '))}`);
        }
      }
    } catch (error) {
      console.error('Failed to list routes:', error);
      process.exit(1);
    }
  });

program
  .command('enable')
  .description('Enable a route')
  .argument('<domain>', 'Domain to enable')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (domain, options) => {
    try {
      const configManager = new ConfigManager(options.config);
      await configManager.load();
      await configManager.updateRoute(domain, { enabled: true });
      console.log(`${Colors.success()('Route enabled:')} ${Colors.domain(domain)(domain)}`);
    } catch (error) {
      console.error('Failed to enable route:', error);
      process.exit(1);
    }
  });

program
  .command('disable')
  .description('Disable a route')
  .argument('<domain>', 'Domain to disable')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (domain, options) => {
    try {
      const configManager = new ConfigManager(options.config);
      await configManager.load();
      await configManager.updateRoute(domain, { enabled: false });
      console.log(`${Colors.warning()('Route disabled:')} ${Colors.domain(domain)(domain)}`);
    } catch (error) {
      console.error('Failed to disable route:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Launch configuration TUI or show current configuration')
  .option('-c, --config <path>', 'Configuration file path')
  .option('--tui', 'Launch interactive TUI', true)
  .option('--json', 'Show configuration as JSON (disables TUI)')
  .action(async (options) => {
    try {
      if (options.json) {
        // Show JSON configuration
        const configManager = new ConfigManager(options.config);
        await configManager.load();
        const config = configManager.getConfig();
        console.log(JSON.stringify(config, null, 2));
      } else {
        // Launch TUI
        const tui = new ConfigTUI(options.config);
        await tui.start();
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      process.exit(1);
    }
  });

program
  .command('set-logging')
  .description('Set global or domain-specific logging level')
  .argument('<level>', 'Logging level (none, error, warn, info, debug)')
  .option('-d, --domain <domain>', 'Set logging for specific domain')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (level, options) => {
    try {
      const validLevels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
      if (!validLevels.includes(level as LogLevel)) {
        console.error('Invalid logging level. Valid levels:', validLevels.join(', '));
        process.exit(1);
      }

      const configManager = new ConfigManager(options.config);
      await configManager.load();
      
      if (options.domain) {
        await configManager.updateRoute(options.domain, { logging: level as LogLevel });
        const levelColored = Colors.logLevel(level as LogLevel)(level);
        const domainColored = Colors.domain(options.domain)(options.domain);
        console.log(`${Colors.success()('Logging level set for')} ${domainColored}: ${levelColored}`);
      } else {
        const config = configManager.getConfig();
        config.global.logging = level as LogLevel;
        await configManager.save();
        const levelColored = Colors.logLevel(level as LogLevel)(level);
        console.log(`${Colors.success()('Global logging level set:')} ${levelColored}`);
      }
    } catch (error) {
      console.error('Failed to set logging level:', error);
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('View live logs from the proxy server')
  .option('-l, --level <level>', 'Filter by log level (error, warn, info, debug)')
  .option('-d, --domain <domain>', 'Filter by domain')
  .option('-f, --format <format>', 'Output format (pretty, json)', 'pretty')
  .option('-n, --no-follow', 'Don\'t follow new logs')
  .option('-h, --history', 'Show historical logs')
  .option('-p, --port <number>', 'WebSocket port', '8089')
  .action(async (options) => {
    try {
      const WebSocket = require('ws');
      
      const queryParams = new URLSearchParams();
      if (options.level) queryParams.set('level', options.level);
      if (options.domain) queryParams.set('domain', options.domain);
      if (options.format) queryParams.set('format', options.format);
      if (!options.follow) queryParams.set('follow', 'false');
      if (options.history) queryParams.set('history', 'true');
      
      const wsUrl = `ws://localhost:${options.port}/logs?${queryParams.toString()}`;
      
      console.log(`Connecting to log stream at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log(`${Colors.success()('Connected to log stream.')} Press Ctrl+C to exit.\n`);
      });
      
      ws.on('message', (data: Buffer) => {
        const message = data.toString();
        console.log(message);
      });
      
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error.message);
        process.exit(1);
      });
      
      ws.on('close', () => {
        console.log(`\n${Colors.warning()('Log stream closed')}`);
        process.exit(0);
      });
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(`\n${Colors.warning()('Closing log stream...')}`);
        ws.close();
      });
      
    } catch (error) {
      console.error('Failed to connect to log stream:', error);
      process.exit(1);
    }
  });

program
  .command('tail')
  .description('Tail log file (alternative to WebSocket logs)')
  .argument('[file]', 'Log file path', './proxy.log')
  .option('-f, --follow', 'Follow the log file', true)
  .option('-n, --lines <number>', 'Number of lines to show', '20')
  .action(async (file, options) => {
    try {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      // Check if file exists
      if (!fs.existsSync(file)) {
        console.error(`Log file not found: ${file}`);
        console.log('Make sure to start the server with --log-file option');
        process.exit(1);
      }
      
      const args = ['-n', options.lines];
      if (options.follow) args.push('-f');
      args.push(file);
      
      const tail = spawn('tail', args, { stdio: 'inherit' });
      
      tail.on('error', (error: Error) => {
        console.error('Failed to tail log file:', error.message);
        process.exit(1);
      });
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to tail log file:', error);
      process.exit(1);
    }
  });

program
  .command('firewall')
  .description('Manage packet filter firewall rules for HTTP interception')
  .action(() => {
    console.log('Available firewall commands:');
    console.log('  firewall install   - Install firewall rules (requires sudo)');
    console.log('  firewall uninstall - Remove firewall rules (requires sudo)');
    console.log('  firewall status    - Check firewall status');
  });

program
  .command('firewall-install')
  .alias('firewall install')
  .description('Install packet filter rules to intercept HTTP traffic (requires sudo)')
  .option('-p, --port <number>', 'HTTP proxy port', '8080')
  .action(async (options) => {
    try {
      const port = parseInt(options.port);
      const firewall = new FirewallManager(port);
      firewall.install();
    } catch (error) {
      console.error('Failed to install firewall rules:', error);
      process.exit(1);
    }
  });

program
  .command('firewall-uninstall')
  .alias('firewall uninstall')
  .description('Remove packet filter rules (requires sudo)')
  .action(async () => {
    try {
      const firewall = new FirewallManager();
      firewall.uninstall();
    } catch (error) {
      console.error('Failed to uninstall firewall rules:', error);
      process.exit(1);
    }
  });

program
  .command('firewall-status')
  .alias('firewall status')
  .description('Check packet filter firewall status')
  .action(async () => {
    try {
      const firewall = new FirewallManager();
      firewall.status();
    } catch (error) {
      console.error('Failed to check firewall status:', error);
      process.exit(1);
    }
  });

program.parse();