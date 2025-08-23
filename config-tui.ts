import blessed from 'blessed';
import { ConfigManager } from './config-manager';
import { ProxyConfig, RouteConfig, LogLevel } from './types';

export class ConfigTUI {
  private screen: blessed.Widgets.Screen;
  private configManager: ConfigManager;
  private config: ProxyConfig;
  private routesList!: blessed.Widgets.ListElement;
  private globalBox!: blessed.Widgets.BoxElement;
  private detailBox!: blessed.Widgets.BoxElement;
  private statusBar!: blessed.Widgets.BoxElement;
  private currentView: 'routes' | 'global' = 'routes';
  private selectedRoute?: string;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
    this.config = this.configManager.getConfig();
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'hop2it Configuration'
    });

    this.setupUI();
    this.setupEventHandlers();
  }

  private setupUI(): void {
    // Header
    const header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}hop2it Configuration Manager{/bold}{/center}\n{center}Press \'q\' to quit, \'h\' for help{/center}',
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue'
      }
    });

    // Routes list (left panel)
    this.routesList = blessed.list({
      label: ' Routes ',
      top: 3,
      left: 0,
      width: '50%',
      height: '70%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        },
        selected: {
          bg: 'blue'
        }
      },
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true
    });

    // Global config (right top)
    this.globalBox = blessed.box({
      label: ' Global Configuration ',
      top: 3,
      left: '50%',
      width: '50%',
      height: '35%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      },
      scrollable: true,
      tags: true
    });

    // Route details (right bottom)
    this.detailBox = blessed.box({
      label: ' Route Details ',
      top: '38%',
      left: '50%',
      width: '50%',
      height: '35%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        }
      },
      scrollable: true,
      tags: true
    });

    // Status bar
    this.statusBar = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      style: {
        fg: 'white',
        bg: 'black'
      },
      tags: true
    });

    // Help text
    this.updateStatusBar('Ready');

    // Add all elements to screen
    this.screen.append(header);
    this.screen.append(this.routesList);
    this.screen.append(this.globalBox);
    this.screen.append(this.detailBox);
    this.screen.append(this.statusBar);

    this.screen.render();
  }

  private setupEventHandlers(): void {
    // Quit
    this.screen.key(['q', 'C-c'], () => {
      process.exit(0);
    });

    // Help
    this.screen.key(['h'], () => {
      this.showHelp();
    });

    // Refresh
    this.screen.key(['r'], async () => {
      await this.refresh();
    });

    // Add route
    this.screen.key(['a'], () => {
      this.addRoute();
    });

    // Delete route
    this.screen.key(['d'], () => {
      this.deleteRoute();
    });

    // Edit route
    this.screen.key(['e'], () => {
      this.editRoute();
    });

    // Configure logging
    this.screen.key(['l'], () => {
      this.configureRouteLogging();
    });

    // Toggle route enabled/disabled
    this.screen.key(['t'], () => {
      this.toggleRoute();
    });

    // Edit global config
    this.screen.key(['g'], () => {
      this.editGlobalConfig();
    });

    // Route selection
    this.routesList.on('select', (item) => {
      const routeName = this.extractRouteNameFromItem(item.getText());
      this.selectedRoute = routeName;
      this.updateRouteDetails(routeName);
    });
    
    // Handle keyboard navigation - update details on movement
    this.routesList.on('select item', (item: any) => {
      const routeName = this.extractRouteNameFromItem(item.getText());
      this.selectedRoute = routeName;
      this.updateRouteDetails(routeName);
      this.screen.render();
    });

    // Config change listener
    this.configManager.on('config-changed', (config: ProxyConfig) => {
      this.config = config;
      this.updateDisplay();
      this.updateStatusBar('Configuration reloaded');
    });
  }

  async start(): Promise<void> {
    try {
      await this.configManager.load();
      this.configManager.startWatching();
      this.config = this.configManager.getConfig();
      this.updateDisplay();
      this.routesList.focus();
    } catch (error) {
      this.updateStatusBar(`Error: ${(error as Error).message}`, 'error');
    }
  }

  private updateDisplay(): void {
    this.updateRoutesList();
    this.updateGlobalConfig();
    if (this.selectedRoute) {
      this.updateRouteDetails(this.selectedRoute);
    }
    this.screen.render();
  }

  private updateRoutesList(): void {
    const routes = Object.entries(this.config.routes);
    const items = routes.map(([domain, route]) => {
      const status = route.enabled ? '✓' : '✗';
      const target = route.target.length > 25 ? route.target.substring(0, 22) + '...' : route.target;
      return `${domain} ${status} ${target}`;
    });

    this.routesList.setItems(items);
    
    // Auto-select first route if none selected and routes exist
    if (!this.selectedRoute && routes.length > 0) {
      const firstRoute = routes[0][0];
      this.selectedRoute = firstRoute;
      this.routesList.select(0);
      this.updateRouteDetails(firstRoute);
    }
  }

  private updateGlobalConfig(): void {
    const content = [
      `{bold}Port:{/bold} ${this.config.global.port}`,
      `{bold}Logging:{/bold} ${this.config.global.logging}`,
      `{bold}Tracing:{/bold} ${this.config.global.tracing ? 'enabled' : 'disabled'}`,
      this.config.global.configFile ? `{bold}Config File:{/bold} ${this.config.global.configFile}` : ''
    ].filter(Boolean).join('\n');

    this.globalBox.setContent(content);
  }

  private updateRouteDetails(domain: string): void {
    const route = this.config.routes[domain];
    if (!route) {
      this.detailBox.setContent('No route selected');
      return;
    }

    const logDetails = [];
    if (route.logRequestHeaders) logDetails.push('req-headers');
    if (route.logRequestBody) logDetails.push('req-body');
    if (route.logResponseHeaders) logDetails.push('res-headers');
    if (route.logResponseBody) logDetails.push('res-body');
    
    const content = [
      `{bold}Domain:{/bold} ${domain}`,
      `{bold}Target:{/bold} ${route.target}`,
      route.path ? `{bold}Path:{/bold} ${route.path}` : '',
      route.pathReplace ? `{bold}Path Replace:{/bold} ${route.pathReplace}` : '',
      `{bold}Enabled:{/bold} ${route.enabled ? 'Yes' : 'No'}`,
      `{bold}Logging Level:{/bold} ${route.logging || 'default'}`,
      `{bold}Detailed Logging:{/bold} ${logDetails.length > 0 ? logDetails.join(', ') : 'none'}`,
      '',
      '{bold}Actions:{/bold}',
      '  [e] Edit route',
      '  [l] Configure logging',
      '  [t] Toggle enabled/disabled',
      '  [d] Delete route'
    ].filter(Boolean).join('\n');

    this.detailBox.setContent(content);
  }

  private extractRouteNameFromItem(itemText: string): string {
    // Extract the domain name from the formatted list item
    // Format: "domain status target"
    const parts = itemText.split(' ');
    // Find the first part that looks like a domain (contains dot or is 'localhost')
    for (const part of parts) {
      if (part.includes('.') || part === 'localhost') {
        return part;
      }
    }
    // Fallback to first part
    return parts[0];
  }

  private updateStatusBar(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'white';
    const keybinds = '[q]uit [h]elp [r]efresh [a]dd [e]dit [l]ogging [d]elete [t]oggle [g]lobal';
    
    this.statusBar.setContent(`{${color}-fg}${message}{/} | ${keybinds}`);
    this.screen.render();
  }

  private showHelp(): void {
    const helpText = `
{center}{bold}hop2it Configuration Help{/bold}{/center}

{bold}Navigation:{/bold}
  ↑/↓, j/k    Navigate routes list
  Enter       Select route

{bold}Actions:{/bold}
  q           Quit application
  h           Show this help
  r           Refresh configuration
  a           Add new route
  e           Edit selected route
  l           Configure route logging
  d           Delete selected route
  t           Toggle route enabled/disabled
  g           Edit global configuration

{bold}Route Management:{/bold}
  • Routes are automatically saved to the config file
  • Changes are reflected immediately if server is running
  • Use wildcard domains like *.dev.local for subdomain matching

{bold}Logging Configuration:{/bold}
  • Set log levels: none, error, warn, info, debug
  • Enable detailed logging for headers and body content
  • Request/response headers and body can be logged separately

Press any key to close help...
    `;

    const helpBox = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        }
      },
      tags: true
    });

    helpBox.display(helpText, () => {
      this.screen.render();
    });
  }

  private addRoute(): void {
    this.promptInput('Enter domain (e.g., api.local):', '', (domain) => {
      if (!domain) return;
      
      this.promptInput('Enter target URL (e.g., http://127.0.0.1:3000):', '', (target) => {
        if (!target) return;
        
        this.promptInput('Enter path to match (optional):', '', (path) => {
          this.promptInput('Enter path replacement (optional, "null" to unset):', '', async (pathReplace) => {
            try {
              const routeConfig: Partial<RouteConfig> = {};
              if (path) routeConfig.path = path;
              if (pathReplace === 'null') {
                // Don't set pathReplace (leave undefined)
              } else if (pathReplace !== undefined && pathReplace !== null) {
                routeConfig.pathReplace = pathReplace;
              }
              
              await this.configManager.addRoute(domain, target, routeConfig);
              this.updateStatusBar(`Route added: ${domain} -> ${target}`, 'success');
              this.selectedRoute = domain;
            } catch (error) {
              this.updateStatusBar(`Error adding route: ${(error as Error).message}`, 'error');
            }
          });
        });
      });
    });
  }

  private editRoute(): void {
    if (!this.selectedRoute) {
      this.updateStatusBar('No route selected', 'error');
      return;
    }

    const route = this.config.routes[this.selectedRoute];
    const domain = this.selectedRoute;

    this.promptInput('Enter new target URL:', route.target, (target) => {
      if (!target) return;
      
      this.promptInput('Enter path to match (optional):', route.path || '', (path) => {
        this.promptInput('Enter path replacement (optional, "null" to unset):', route.pathReplace === undefined ? '' : route.pathReplace, (pathReplace) => {
          const logLevels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
          this.promptSelect('Select logging level:', logLevels, route.logging || 'info', async (logging) => {
            try {
              const updates: Partial<RouteConfig> = { 
                target, 
                logging: logging as LogLevel 
              };
              
              if (path) updates.path = path;
              if (pathReplace === 'null') {
                updates.pathReplace = undefined;
              } else if (pathReplace !== undefined && pathReplace !== null) {
                updates.pathReplace = pathReplace;
              }
              
              await this.configManager.updateRoute(domain, updates);
              this.updateStatusBar(`Route updated: ${domain}`, 'success');
            } catch (error) {
              this.updateStatusBar(`Error updating route: ${(error as Error).message}`, 'error');
            }
          });
        });
      });
    });
  }

  private async deleteRoute(): Promise<void> {
    if (!this.selectedRoute) {
      this.updateStatusBar('No route selected', 'error');
      return;
    }

    const domain = this.selectedRoute;
    
    this.promptConfirm(`Delete route '${domain}'?`, async (confirmed) => {
      if (confirmed) {
        try {
          await this.configManager.removeRoute(domain);
          this.selectedRoute = undefined;
          this.detailBox.setContent('No route selected');
          this.updateStatusBar(`Route deleted: ${domain}`, 'success');
        } catch (error) {
          this.updateStatusBar(`Error deleting route: ${(error as Error).message}`, 'error');
        }
      }
    });
  }

  private async toggleRoute(): Promise<void> {
    if (!this.selectedRoute) {
      this.updateStatusBar('No route selected', 'error');
      return;
    }

    const domain = this.selectedRoute;
    const route = this.config.routes[domain];
    const newEnabled = !route.enabled;

    try {
      await this.configManager.updateRoute(domain, { enabled: newEnabled });
      this.updateStatusBar(`Route ${newEnabled ? 'enabled' : 'disabled'}: ${domain}`, 'success');
    } catch (error) {
      this.updateStatusBar(`Error toggling route: ${(error as Error).message}`, 'error');
    }
  }

  private configureRouteLogging(): void {
    if (!this.selectedRoute) {
      this.updateStatusBar('No route selected', 'error');
      return;
    }

    const domain = this.selectedRoute;
    const route = this.config.routes[domain];
    
    // Create a logging configuration dialog
    this.showLoggingConfigDialog(domain, route);
  }

  private editGlobalConfig(): void {
    this.promptInput('Enter server port:', this.config.global.port.toString(), (portStr) => {
      const port = parseInt(portStr);
      if (isNaN(port) || port < 1 || port > 65535) {
        this.updateStatusBar('Invalid port number', 'error');
        return;
      }

      const logLevels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
      this.promptSelect('Select global logging level:', logLevels, this.config.global.logging, (logging) => {
        this.promptConfirm('Enable tracing?', async (tracing) => {
          try {
            this.config.global.port = port;
            this.config.global.logging = logging as LogLevel;
            this.config.global.tracing = tracing;
            
            await this.configManager.save();
            this.updateStatusBar('Global configuration updated', 'success');
          } catch (error) {
            this.updateStatusBar(`Error updating global config: ${(error as Error).message}`, 'error');
          }
        });
      });
    });
  }

  private async refresh(): Promise<void> {
    try {
      await this.configManager.load();
      this.config = this.configManager.getConfig();
      this.updateDisplay();
      this.updateStatusBar('Configuration refreshed', 'success');
    } catch (error) {
      this.updateStatusBar(`Error refreshing: ${(error as Error).message}`, 'error');
    }
  }

  private promptInput(prompt: string, defaultValue: string, callback: (value: string) => void): void {
    const inputBox = blessed.textbox({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 5,
      label: ` ${prompt} `,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        }
      },
      inputOnFocus: true
    });

    inputBox.setValue(defaultValue);
    inputBox.focus();

    inputBox.on('submit', (value) => {
      inputBox.destroy();
      this.screen.render();
      callback(value || '');
    });

    inputBox.on('cancel', () => {
      inputBox.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  private promptSelect(prompt: string, options: string[], defaultValue: string, callback: (value: string) => void): void {
    const selectList = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '40%',
      height: Math.min(options.length + 4, 15),
      label: ` ${prompt} `,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        },
        selected: {
          bg: 'blue'
        }
      },
      keys: true,
      vi: true
    });

    selectList.setItems(options);
    
    const defaultIndex = options.indexOf(defaultValue);
    if (defaultIndex >= 0) {
      selectList.select(defaultIndex);
    }

    selectList.focus();

    selectList.on('select', (item) => {
      const value = item.getText();
      selectList.destroy();
      this.screen.render();
      callback(value);
    });

    selectList.key(['escape'], () => {
      selectList.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  private promptConfirm(prompt: string, callback: (confirmed: boolean) => void): void {
    const confirmBox = blessed.question({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 7,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        }
      }
    });

    confirmBox.ask(prompt, (err, confirmed) => {
      callback(!!confirmed);
      this.screen.render();
    });
  }

  private showLoggingConfigDialog(domain: string, route: RouteConfig): void {
    const logBox = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '80%',
      label: ` Logging Configuration for ${domain} `,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        }
      },
      keys: true,
      vi: true
    });

    // Log Level Selection
    const logLevelList = blessed.list({
      parent: logBox,
      label: ' Log Level ',
      top: 1,
      left: 1,
      width: '48%',
      height: 8,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        selected: { bg: 'blue' }
      },
      keys: true,
      vi: true
    });

    const logLevels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
    logLevelList.setItems(logLevels);
    const currentLevelIndex = logLevels.indexOf(route.logging || 'info');
    if (currentLevelIndex >= 0) {
      logLevelList.select(currentLevelIndex);
    }

    // Detailed Logging Checkboxes
    const detailsBox = blessed.box({
      parent: logBox,
      label: ' Detailed Logging ',
      top: 1,
      left: '51%',
      width: '48%',
      height: 8,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' }
      }
    });

    const checkboxes = [
      { name: 'logRequestHeaders', label: 'Request Headers', value: !!route.logRequestHeaders },
      { name: 'logRequestBody', label: 'Request Body', value: !!route.logRequestBody },
      { name: 'logResponseHeaders', label: 'Response Headers', value: !!route.logResponseHeaders },
      { name: 'logResponseBody', label: 'Response Body', value: !!route.logResponseBody }
    ];

    const checkboxElements = checkboxes.map((cb, index) => {
      const checkbox = blessed.checkbox({
        parent: detailsBox,
        top: index + 1,
        left: 1,
        width: '90%',
        height: 1,
        text: cb.label,
        checked: cb.value,
        style: {
          focus: { bg: 'blue' }
        },
        keys: true
      });
      (checkbox as any).checkboxName = cb.name;
      return checkbox;
    });

    // Instructions
    const instructionsBox = blessed.box({
      parent: logBox,
      top: 10,
      left: 1,
      width: '98%',
      height: 5,
      content: '{center}Use arrow keys to navigate, Space to toggle checkboxes{/center}\\n{center}Press Enter to save, Escape to cancel{/center}',
      tags: true,
      style: {
        fg: 'yellow'
      }
    });

    // Handle form submission
    logBox.key(['enter'], async () => {
      try {
        const selectedIndex = (logLevelList as any).selected || 0;
        const selectedLogLevel = logLevels[selectedIndex];
        const updates: Partial<RouteConfig> = {
          logging: selectedLogLevel as LogLevel
        };

        // Get checkbox states
        checkboxElements.forEach((checkbox) => {
          const name = (checkbox as any).checkboxName;
          (updates as any)[name] = (checkbox as any).checked;
        });

        await this.configManager.updateRoute(domain, updates);
        logBox.destroy();
        this.updateStatusBar(`Logging configuration updated for ${domain}`, 'success');
        this.screen.render();
      } catch (error) {
        this.updateStatusBar(`Error updating logging: ${(error as Error).message}`, 'error');
      }
    });

    logBox.key(['escape'], () => {
      logBox.destroy();
      this.screen.render();
    });

    logBox.focus();
    logLevelList.focus();
    this.screen.render();
  }
}