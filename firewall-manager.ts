import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import * as os from 'os';
import { ConfigManager } from './config-manager';

export class FirewallManager {
    private readonly plistLabel = 'com.olson3r.hop2it.firewall';
    private readonly plistFileName = 'com.olson3r.hop2it.firewall.plist';
    private readonly pfConfFileName = 'com.olson3r.hop2it.pf.conf';
    private readonly launchDaemonPath = '/Library/LaunchDaemons';
    private readonly httpPort: number;
    private readonly hostsMarker = '# hop2it managed domains';

    constructor(httpPort: number = 8080) {
        this.httpPort = httpPort;
    }

    install(): void {
        try {
            console.log('Installing hop2it firewall rules...');
            
            // Check if running as root
            if (process.getuid && process.getuid() !== 0) {
                throw new Error('Firewall installation requires root privileges. Please run with sudo.');
            }

            // Generate plist file from template
            const plistTemplate = fs.readFileSync(
                path.join(__dirname, '..', 'templates', this.plistFileName),
                'utf8'
            );
            const plistContent = plistTemplate.replace(/HTTP_PORT/g, this.httpPort.toString());
            const plistPath = path.join(this.launchDaemonPath, this.plistFileName);
            
            // Generate pf.conf file from template
            const pfTemplate = fs.readFileSync(
                path.join(__dirname, '..', 'templates', this.pfConfFileName),
                'utf8'
            );
            const pfContent = pfTemplate.replace(/HTTP_PORT/g, this.httpPort.toString());
            const pfPath = path.join('/etc', this.pfConfFileName);
            
            // Write files
            fs.writeFileSync(plistPath, plistContent);
            fs.writeFileSync(pfPath, pfContent);
            
            // Set proper permissions
            fs.chmodSync(plistPath, 0o644);
            fs.chmodSync(pfPath, 0o644);
            
            // Load the launch daemon
            execSync(`launchctl load -w ${plistPath}`);
            
            // Add hosts entries for configured domains
            this.updateHostsFile();
            
            console.log(`Firewall rules installed successfully. HTTP traffic will be redirected to port ${this.httpPort}.`);
            console.log('Note: You may need to restart for changes to take full effect.');
            
        } catch (error) {
            console.error('Failed to install firewall rules:', error);
            throw error;
        }
    }

    uninstall(): void {
        try {
            console.log('Removing hop2it firewall rules...');
            
            // Check if running as root
            if (process.getuid && process.getuid() !== 0) {
                throw new Error('Firewall removal requires root privileges. Please run with sudo.');
            }

            const plistPath = path.join(this.launchDaemonPath, this.plistFileName);
            const pfPath = path.join('/etc', this.pfConfFileName);
            
            // Unload the launch daemon if it exists
            if (fs.existsSync(plistPath)) {
                try {
                    execSync(`launchctl unload -w ${plistPath}`);
                } catch (e) {
                    // Ignore errors if already unloaded
                }
                fs.unlinkSync(plistPath);
            }
            
            // Remove pf configuration
            if (fs.existsSync(pfPath)) {
                fs.unlinkSync(pfPath);
            }
            
            // Reset packet filter to default
            try {
                execSync('pfctl -d 2>/dev/null');
            } catch (e) {
                // Ignore errors
            }
            
            // Remove hosts entries
            this.removeHostsEntries();
            
            console.log('Firewall rules removed successfully.');
            
        } catch (error) {
            console.error('Failed to remove firewall rules:', error);
            throw error;
        }
    }

    status(): boolean {
        try {
            const plistPath = path.join(this.launchDaemonPath, this.plistFileName);
            if (!fs.existsSync(plistPath)) {
                console.log('Firewall rules not installed.');
                return false;
            }
            
            // Check if launch daemon is loaded
            try {
                const output = execSync(`launchctl list | grep ${this.plistLabel}`, { encoding: 'utf8' });
                console.log(`Firewall rules are active. HTTP traffic is being redirected to port ${this.httpPort}.`);
                return true;
            } catch (e) {
                console.log('Firewall rules are installed but not active.');
                return false;
            }
            
        } catch (error) {
            console.error('Failed to check firewall status:', error);
            return false;
        }
    }

    private updateHostsFile(): void {
        try {
            // Use the same config path resolution as ConfigManager
            const configPath = path.join(homedir(), '.hop2it', 'proxy-config.json');
            if (!fs.existsSync(configPath)) {
                console.log('No proxy config found, skipping hosts file update.');
                return;
            }
            
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            const domains = Object.keys(config.routes || {});
            if (domains.length === 0) {
                console.log('No domains configured, skipping hosts file update.');
                return;
            }
            
            

            // Read current hosts file
            const hostsPath = '/etc/hosts';
            const hostsContent = fs.readFileSync(hostsPath, 'utf8');
            
            // Remove existing hop2it entries
            const lines = hostsContent.split('\n');
            const filteredLines = [];
            let inHop2itSection = false;

            for (const line of lines) {
                if (line.includes(this.hostsMarker)) {
                    if (line.includes('START')) {
                        inHop2itSection = true;
                        continue;
                    } else if (line.includes('END')) {
                        inHop2itSection = false;
                        continue;
                    }
                }
                
                if (!inHop2itSection) {
                    filteredLines.push(line);
                }
            }

            // Add new hop2it entries
            filteredLines.push('');
            filteredLines.push(`${this.hostsMarker} START`);
            
            // Extract unique domains from route keys
            const uniqueDomains = new Set<string>();
            domains.forEach(routeKey => {
                // Extract domain from route key (handle domain:path format)
                let domain = routeKey;
                if (routeKey.includes(':')) {
                    domain = routeKey.split(':')[0];
                }
                
                // Skip wildcard domains - they can't be resolved directly
                if (!domain.startsWith('*')) {
                    uniqueDomains.add(domain);
                }
            });
            
            // Add hosts entries for unique domains  
            const domainsToAdd = Array.from(uniqueDomains).sort();
            domainsToAdd.forEach(domain => {
                filteredLines.push(`127.0.0.1 ${domain}`);
            });
            
            filteredLines.push(`${this.hostsMarker} END`);
            
            // Write back to hosts file
            fs.writeFileSync(hostsPath, filteredLines.join('\n'));
            
            console.log(`Added ${domainsToAdd.length} domain(s) to /etc/hosts`);
            
        } catch (error) {
            console.error('Failed to update hosts file:', error);
            console.error('Error details:', error instanceof Error ? error.message : String(error));
            // Don't throw - firewall can still work with manual DNS setup
        }
    }

    private removeHostsEntries(): void {
        try {
            const hostsPath = '/etc/hosts';
            const hostsContent = fs.readFileSync(hostsPath, 'utf8');
            
            // Remove hop2it entries
            const lines = hostsContent.split('\n');
            const filteredLines = [];
            let inHop2itSection = false;

            for (const line of lines) {
                if (line.includes(this.hostsMarker)) {
                    if (line.includes('START')) {
                        inHop2itSection = true;
                        continue;
                    } else if (line.includes('END')) {
                        inHop2itSection = false;
                        continue;
                    }
                }
                
                if (!inHop2itSection) {
                    filteredLines.push(line);
                }
            }

            // Remove trailing empty lines that might have been left
            while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === '') {
                filteredLines.pop();
            }
            
            fs.writeFileSync(hostsPath, filteredLines.join('\n') + '\n');
            console.log('Removed hop2it entries from /etc/hosts');
            
        } catch (error) {
            console.error('Failed to remove hosts entries:', error);
            // Don't throw - this is cleanup
        }
    }
}