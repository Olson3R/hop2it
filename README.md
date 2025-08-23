# 🐰 hop2it

A powerful, feature-rich local development proxy server that routes requests by domain to different local services. Perfect for microservices development, API testing, and local environment management.

## ✨ Features

- **🎯 Domain-based routing** - Route requests by domain (including wildcards)
- **🛤️ Path-based routing** - Route requests by URL path with replacements
- **🔗 WebSocket proxying** - Full WebSocket support with path rewriting
- **🔄 Hot-reloadable configuration** - Changes apply instantly without restart
- **📊 Real-time request tracing** - Detailed logging with unique trace IDs
- **🎨 Colorized console output** - Beautiful, readable logs with timestamps
- **📁 Log file rotation** - Automatic log management with size limits
- **🔒 Smart data masking** - Secure logging of sensitive information
- **📱 Interactive TUI** - Terminal-based configuration management
- **🌊 Live log streaming** - WebSocket-based log viewing for multiple clients
- **🔍 Request/response inspection** - Optional headers and body logging
- **⚙️ Flexible configuration** - JSON-based config with CLI overrides
- **🏠 Global configuration** - Config stored in `~/.hop2it/proxy-config.json`

## 🌍 Platform Support

| Feature | Windows | macOS | Linux |
|---------|---------|----------|-------|
| **Core proxy server** | ✅ | ✅ | ✅ |
| **Domain/path routing** | ✅ | ✅ | ✅ |
| **WebSocket proxying** | ✅ | ✅ | ✅ |
| **Config TUI** | ✅ | ✅ | ✅ |
| **Log streaming** | ✅ | ✅ | ✅ |
| **Firewall rules** | ❌ | ✅ | 🔄* |

**Requirements:** Node.js >=16.0.0

*Linux firewall support requires iptables (not yet implemented)

## 🚀 Quick Start

### Installation

```bash
# Install globally from npm (when published)
npm install -g hop2it

# Or install from source
git clone <repository>
cd hop2it
npm install
npm run build
npm install -g .
```

### Basic Usage

```bash
# Start the proxy server
hop2it start

# Add a route
hop2it add api.local http://127.0.0.1:3001

# List all routes
hop2it list

# View live logs
hop2it logs

# Launch configuration TUI
hop2it config
```

## 📖 Documentation

### Command Reference

#### Starting the Server

```bash
# Basic start
hop2it start

# With custom port
hop2it start --port 9000

# With file logging and rotation
hop2it start --log-file ./logs/proxy.log \
  --log-max-size 50 --log-max-files 10

# With custom configuration
hop2it start --config ./my-config.json
```

#### Route Management

```bash
# Add a basic route
hop2it add api.local http://127.0.0.1:3001

# Add route with path matching and replacement
hop2it add "*.dev.local" http://127.0.0.1:4000 \
  --path "/api" \
  --path-replace "/v2"

# Add route with path removal (strip /api prefix)
hop2it add api.local http://127.0.0.1:3001 \
  --path "/api" \
  --path-replace ""

# Add route with detailed logging
hop2it add api.local http://127.0.0.1:3001 \
  --log-request-headers \
  --log-request-body \
  --log-response-headers \
  --log-response-body \
  --logging debug

# List all routes with details
hop2it list

# Enable/disable routes
hop2it enable api.local
hop2it disable api.local

# Remove routes
hop2it remove api.local
```

#### Log Management

```bash
# View live logs (WebSocket-based)
hop2it logs

# Filter logs by level and domain
hop2it logs --level info --domain api.local

# View logs in JSON format with history
hop2it logs --format json --history

# Tail log file (traditional file-based)
hop2it tail ./logs/proxy.log

# View last 100 lines without following
hop2it tail ./logs/proxy.log --lines 100 --no-follow
```

#### Configuration Management

```bash
# Launch interactive TUI
hop2it config

# View configuration as JSON
hop2it config --json

# Set logging levels
hop2it set-logging debug --domain api.local
hop2it set-logging info  # Global level
```

### Configuration File

The configuration is stored in `~/.hop2it/proxy-config.json` and controls all server behavior:

```json
{
  "routes": {
    "api.local": {
      "target": "http://127.0.0.1:3001",
      "logging": "debug",
      "enabled": true,
      "logRequestHeaders": true,
      "logRequestBody": true,
      "logResponseHeaders": false,
      "logResponseBody": false
    },
    "app.local": {
      "target": "http://127.0.0.1:3000",
      "logging": "info",
      "enabled": true
    },
    "*.dev.local:/api": {
      "target": "http://127.0.0.1:8000",
      "pathReplace": "/v2",
      "logging": "warn",
      "enabled": true
    },
    "*.dev.local": {
      "target": "http://127.0.0.1:3000",
      "logging": "info",
      "enabled": true
    }
  },
  "global": {
    "port": 8080,
    "logging": "info",
    "tracing": true,
    "logRequestHeaders": false,
    "logRequestBody": false,
    "logResponseHeaders": false,
    "logResponseBody": false,
    "logRotation": {
      "maxFileSize": 10485760,
      "maxFiles": 5,
      "compress": false
    }
  }
}
```

### Route Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `target` | string | Target URL to proxy requests to |
| `path` | string | Path pattern to match (e.g., `/api`) |
| `pathReplace` | string | Replacement for matched path (e.g., `/v2`, `""` for removal) |
| `enabled` | boolean | Whether the route is active |
| `logging` | LogLevel | Log level for this route (`none`, `error`, `warn`, `info`, `debug`) |
| `logRequestHeaders` | boolean | Log incoming request headers |
| `logRequestBody` | boolean | Log request body content |
| `logResponseHeaders` | boolean | Log outgoing response headers |
| `logResponseBody` | boolean | Log response body content |

### Global Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `port` | number | Proxy server port |
| `logging` | LogLevel | Global log level |
| `tracing` | boolean | Enable request tracing |
| `logRequestHeaders` | boolean | Default for request header logging |
| `logRequestBody` | boolean | Default for request body logging |
| `logResponseHeaders` | boolean | Default for response header logging |
| `logResponseBody` | boolean | Default for response body logging |
| `logRotation` | object | Log file rotation settings |

### Log Rotation Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxFileSize` | number | 10MB | Maximum size per log file (bytes) |
| `maxFiles` | number | 5 | Number of rotated files to keep |
| `compress` | boolean | false | Compress rotated files (future feature) |

### Path-Based Routing

hop2it supports sophisticated path-based routing with URL rewriting:

#### Route Key Syntax

```json
{
  "routes": {
    "domain.com:/api": {  // Exact domain + path
      "target": "http://127.0.0.1:4000",
      "pathReplace": "/v2"  // /api/users becomes /v2/users
    },
    "*.dev.local:/api": { // Wildcard domain + path
      "target": "http://127.0.0.1:3000",
      "pathReplace": ""      // /api/users becomes /users (path removal)
    },
    "*.dev.local": {      // Catch-all for other paths
      "target": "http://127.0.0.1:8000"
    }
  }
}
```

#### Path Replacement Examples

| Original Path | Path Replace | Result Path | Description |
|---------------|--------------|-------------|-------------|
| `/api/users` | `"/v2"` | `/v2/users` | Replace prefix |
| `/api/users` | `""` | `/users` | Remove prefix |
| `/api/users` | `"/"` | `//users` | Replace with root |
| `/api/users` | `undefined` | `/api/users` | No replacement |

#### Route Priority

Routes are prioritized by specificity:
1. **Exact domain + longest path** (highest priority)
2. **Wildcard domain + longest path**
3. **Exact domain + shorter path**
4. **Wildcard domain + shorter path**
5. **Domain without path** (lowest priority)

### WebSocket Support

hop2it provides full WebSocket proxying with the same routing and path replacement features:

```bash
# WebSocket connections are automatically detected and proxied
# Same routing rules apply as HTTP requests
# Path replacement works for WebSocket URLs too
```

**WebSocket Features:**
- 🔗 Automatic WebSocket upgrade handling
- 🛤️ Same path-based routing as HTTP
- 🔄 Path replacement for WebSocket URLs
- 📊 Connection lifecycle logging
- ⚙️ Same headers forwarded (x-forwarded-host, x-trace-id)

**WebSocket Log Output:**
```
🔌 WebSocket /api/ws → http://127.0.0.1:4002
WebSocket path rewritten: /api/ws → /ws
WebSocket connection established
WebSocket connection closed
```

## 🛠 Development Workflows

### Microservices Development

```bash
# Set up routes for different services
hop2it add auth.local http://127.0.0.1:3001 --logging debug
hop2it add api.local http://127.0.0.1:3002 --logging info
hop2it add frontend.local http://127.0.0.1:3000 --logging warn

# Start with detailed logging
hop2it start --log-file ./dev.log

# Monitor all services in separate terminal
hop2it logs --format pretty
```

### API Testing and Debugging

```bash
# Add API route with full request/response logging
hop2it add api.test http://127.0.0.1:8080 \
  --log-request-headers \
  --log-request-body \
  --log-response-headers \
  --log-response-body \
  --logging debug

# View filtered logs for API debugging
hop2it logs --domain api.test --level debug
```

### Production-like Environment

```bash
# Set up with log rotation for long-running tests
hop2it start --log-file ./integration.log \
  --log-max-size 100 --log-max-files 20

# Add production-like routes
hop2it add api.staging http://127.0.0.1:4000 --logging info
hop2it add cdn.staging http://127.0.0.1:4001 --logging warn
```

## 🎨 Log Output Examples

### Basic Request Logging
```
14:30:15.234 INFO  [a1b2c3d4] [api.local] GET    /users → http://127.0.0.1:3001 200 45ms
14:30:15.235 INFO  [a1b2c3d4] [api.local] Path rewritten: /api/users → /users
14:30:16.891 INFO  [b2c3d4e5] [app.local] POST   /login → http://127.0.0.1:3000 401 12ms
14:30:17.456 WARN  [c3d4e5f6] [unknown] No route found: GET    /favicon.ico
🔌 14:30:18.123 INFO  [d4e5f6g7] [ws.local] WebSocket /api/stream → http://127.0.0.1:4000
```

### Detailed Request/Response Logging
```
14:30:15.234 INFO  [a1b2c3d4] [api.local] POST   /users → http://127.0.0.1:3001 201 78ms
14:30:15.235 INFO  [a1b2c3d4] [api.local] Request Headers:
  content-type: application/json
  authorization: Bearer eyJ0******************...+87
  user-agent: curl/7.68.0
14:30:15.236 INFO  [a1b2c3d4] [api.local] Request Body:
{
  "name": "John Doe",
  "email": "john@example.com"
}
14:30:15.312 INFO  [a1b2c3d4] [api.local] Response Body:
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-01-15T14:30:15Z"
}
```

## 🔒 Security Features

### Sensitive Data Masking

The proxy automatically masks sensitive information in logs:

```bash
# Authorization headers are intelligently masked
authorization: Bearer eyJ0eXAi... → Bearer eyJ0****************...+87
authorization: Basic dXNlcm5h... → Basic dXNl************

# API keys and tokens are protected
x-api-key: sk_test_1234567890 → sk_t************
cookie: session=abc123def456 → sess****************
```

### Supported Sensitive Headers
- `authorization` - All auth types (Bearer, Basic, etc.)
- `cookie` - Session cookies
- `x-api-key` - API keys
- `x-auth-token` - Authentication tokens
- `x-access-token` - Access tokens
- `proxy-authorization` - Proxy authentication

## 📊 Interactive TUI

Launch the Terminal User Interface for visual configuration management:

```bash
hop2it config
```

**Features:**
- 📋 View all routes and their status
- ⚙️ Edit global configuration
- ➕ Add/remove routes interactively
- 🔄 Toggle routes on/off
- 📝 Modify logging settings
- 🔄 Real-time configuration updates

**Key Bindings:**
- `q` - Quit
- `h` - Help
- `r` - Refresh
- `a` - Add route
- `e` - Edit selected route
- `d` - Delete route
- `t` - Toggle route enabled/disabled
- `g` - Edit global settings

## 🌐 WebSocket Log Streaming

Multiple clients can connect to view logs in real-time:

```bash
# Terminal 1: Start server
hop2it start --log-file ./app.log

# Terminal 2: View all logs
hop2it logs

# Terminal 3: View API logs only
hop2it logs --domain api.local --level debug

# Terminal 4: View JSON format with history
hop2it logs --format json --history
```

**WebSocket Endpoint:** `ws://localhost:8089/logs`

**Query Parameters:**
- `level` - Filter by log level
- `domain` - Filter by specific domain
- `format` - Output format (`pretty` or `json`)
- `follow` - Continue streaming (`true` or `false`)
- `history` - Include historical logs (`true` or `false`)

## 🎯 Use Cases

### Local Development
- Route different subdomains to different local services
- Debug API requests with detailed logging
- Test microservices integration locally

### API Testing
- Monitor request/response payloads
- Track authentication flows
- Debug integration issues

### Development Teams
- Shared configuration for consistent environments
- Real-time log streaming for collaboration
- Hot-reloadable config for rapid iteration

### Integration Testing
- Route test traffic to different service versions
- Log rotation for long-running test suites
- Trace requests across service boundaries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
hop2it start --port 9000
```

**Configuration not loading:**
```bash
hop2it config --json  # Verify config format

# Config is stored globally at ~/.hop2it/proxy-config.json
# Override with custom path:
hop2it start --config ./path/to/config.json
```

**Logs not appearing:**
```bash
# Check log level settings
hop2it set-logging debug

# Verify tracing is enabled
hop2it config --json | grep tracing
```

**WebSocket connection failed:**
```bash
# Check if server is running and port is accessible
netstat -an | grep 8089
```

### Getting Help

- Use `hop2it --help` for command information
- Use `hop2it <command> --help` for specific command help
- Check the configuration with `hop2it config --json`
- Enable debug logging with `hop2it set-logging debug`

---

**Built with ❤️ for developers who need powerful local proxy capabilities.**