# 🔌 API Reference

This document provides detailed API reference for hop2it's programmatic interfaces.

## 📡 WebSocket API

### Log Streaming Endpoint

**Endpoint:** `ws://localhost:8089/logs`

Connect to this WebSocket endpoint to receive real-time log streams.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `level` | string | - | Filter by log level (`error`, `warn`, `info`, `debug`) |
| `domain` | string | - | Filter by specific domain |
| `format` | string | `pretty` | Output format (`pretty` or `json`) |
| `follow` | boolean | `true` | Continue streaming new logs |
| `history` | boolean | `false` | Include historical logs from buffer |

#### Connection Examples

```javascript
// Basic connection
const ws = new WebSocket('ws://localhost:8089/logs');

// With filtering
const ws = new WebSocket('ws://localhost:8089/logs?level=error&domain=api.local');

// JSON format with history
const ws = new WebSocket('ws://localhost:8089/logs?format=json&history=true');
```

#### Message Format

**Pretty Format:**
```
14:30:15.234 INFO  [a1b2c3d4] [api.local] GET /users → http://localhost:3001 200 45ms
```

**JSON Format:**
```json
{
  "timestamp": 1704371415234,
  "level": "info",
  "traceId": "a1b2c3d4", 
  "domain": "api.local",
  "message": "GET /users → http://localhost:3001 200 45ms"
}
```

#### Client Implementation Examples

**Node.js Client:**
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8089/logs?format=json');

ws.on('open', () => {
  console.log('Connected to log stream');
});

ws.on('message', (data) => {
  const logEntry = JSON.parse(data.toString());
  console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.message}`);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

**Browser Client:**
```javascript
const ws = new WebSocket('ws://localhost:8089/logs?level=error');

ws.onopen = () => {
  console.log('Connected to error stream');
};

ws.onmessage = (event) => {
  console.error('Proxy Error:', event.data);
};

ws.onerror = (error) => {
  console.error('Connection error:', error);
};
```

**Python Client:**
```python
import websocket
import json

def on_message(ws, message):
    if message.startswith('{'):
        log_entry = json.loads(message)
        print(f"[{log_entry['level'].upper()}] {log_entry['message']}")
    else:
        print(message)

def on_error(ws, error):
    print(f"Error: {error}")

def on_open(ws):
    print("Connected to log stream")

ws = websocket.WebSocketApp(
    "ws://localhost:8089/logs?format=json&level=info",
    on_message=on_message,
    on_error=on_error,
    on_open=on_open
)

ws.run_forever()
```

## 🗂 Configuration File Schema

### Complete Configuration Schema

```typescript
interface ProxyConfig {
  routes: Record<string, RouteConfig>;
  global: GlobalConfig;
}

interface RouteConfig {
  target: string;                    // Target URL
  enabled?: boolean;                 // Route enabled state
  logging?: LogLevel;                // Route-specific log level
  logRequestHeaders?: boolean;       // Log request headers
  logRequestBody?: boolean;          // Log request body
  logResponseHeaders?: boolean;      // Log response headers  
  logResponseBody?: boolean;         // Log response body
}

interface GlobalConfig {
  port: number;                      // Proxy server port
  logging: LogLevel;                 // Global log level
  tracing: boolean;                  // Enable request tracing
  configFile?: string;               // Config file path
  logRequestHeaders?: boolean;       // Default request header logging
  logRequestBody?: boolean;          // Default request body logging
  logResponseHeaders?: boolean;      // Default response header logging
  logResponseBody?: boolean;         // Default response body logging
  logRotation?: LogRotationConfig;   // Log rotation settings
}

interface LogRotationConfig {
  maxFileSize?: number;              // Max file size in bytes (default: 10MB)
  maxFiles?: number;                 // Number of files to keep (default: 5)
  compress?: boolean;                // Compress rotated files (default: false)
}

type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';
```

### Configuration Examples

**Minimal Configuration:**
```json
{
  "routes": {
    "api.local": {
      "target": "http://localhost:3001"
    }
  },
  "global": {
    "port": 8080,
    "logging": "info",
    "tracing": true
  }
}
```

**Development Configuration:**
```json
{
  "routes": {
    "api.local": {
      "target": "http://localhost:3001",
      "logging": "debug",
      "enabled": true,
      "logRequestHeaders": true,
      "logRequestBody": true,
      "logResponseBody": true
    },
    "app.local": {
      "target": "http://localhost:3000",
      "logging": "info",
      "enabled": true
    },
    "*.dev.local": {
      "target": "http://localhost:8000",
      "logging": "warn",
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
      "maxFileSize": 52428800,
      "maxFiles": 10,
      "compress": false
    }
  }
}
```

**Production Configuration:**
```json
{
  "routes": {
    "api.prod.local": {
      "target": "http://localhost:4000",
      "logging": "warn",
      "enabled": true,
      "logRequestHeaders": false,
      "logRequestBody": false,
      "logResponseHeaders": false,
      "logResponseBody": false
    },
    "health.prod.local": {
      "target": "http://localhost:4001",
      "logging": "error",
      "enabled": true
    }
  },
  "global": {
    "port": 8080,
    "logging": "warn",
    "tracing": false,
    "logRotation": {
      "maxFileSize": 104857600,
      "maxFiles": 50,
      "compress": true
    }
  }
}
```

## 📝 Log Entry Schema

### Log Entry Structure

```typescript
interface LogEntry {
  timestamp: number;           // Unix timestamp in milliseconds
  level: LogLevel;            // Log level
  traceId: string;            // Request trace ID (8 chars shown)
  message: string;            // Log message
  domain?: string;            // Request domain
  data?: any;                 // Additional structured data
}
```

### Request Trace Structure

```typescript
interface RequestTrace {
  id: string;                    // Full trace ID
  timestamp: number;             // Request start time
  method: string;                // HTTP method
  url: string;                   // Request URL
  headers: Record<string, string>; // Sanitized request headers
  domain: string;                // Request domain
  target?: string;               // Proxy target URL
  duration?: number;             // Response time in ms
  statusCode?: number;           // HTTP status code
  error?: string;                // Error message if failed
  requestBody?: string;          // Request body content
  responseHeaders?: Record<string, string>; // Response headers
  responseBody?: string;         // Response body content
}
```

### Log Message Examples

**Request/Response Log:**
```json
{
  "timestamp": 1704371415234,
  "level": "info",
  "traceId": "a1b2c3d4",
  "domain": "api.local",
  "message": "POST   /users → http://localhost:3001 201 78ms"
}
```

**Error Log:**
```json
{
  "timestamp": 1704371415890,
  "level": "error", 
  "traceId": "b2c3d4e5",
  "domain": "api.local",
  "message": "Proxy error",
  "data": {
    "error": "ECONNREFUSED",
    "target": "http://localhost:3001"
  }
}
```

**Configuration Change Log:**
```json
{
  "timestamp": 1704371416000,
  "level": "info",
  "traceId": "SYSTEM",
  "message": "Configuration reloaded"
}
```

## 🔗 HTTP Headers

### Request Headers Added by Proxy

The proxy adds the following headers to outgoing requests:

| Header | Value | Description |
|--------|-------|-------------|
| `x-trace-id` | `<trace-id>` | Unique request trace identifier |

### Sensitive Headers (Masked in Logs)

The following headers are automatically masked in logs:

- `authorization` - All authorization types
- `cookie` - Session cookies
- `x-api-key` - API keys
- `x-auth-token` - Authentication tokens
- `x-access-token` - Access tokens  
- `proxy-authorization` - Proxy authentication

### Header Masking Algorithm

```typescript
// Authorization headers preserve the auth type
"Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." 
// Becomes: "Bearer eyJ0****************...+87"

"Basic dXNlcm5hbWU6cGFzc3dvcmQ="
// Becomes: "Basic dXNl************"

// Other sensitive headers mask from the beginning
"sk_test_1234567890abcdef"
// Becomes: "sk_t************"
```

## 🎯 Domain Routing Rules

### Route Matching Priority

1. **Exact match** - `api.local` matches exactly
2. **Wildcard match** - `*.dev.local` matches any subdomain

### Wildcard Patterns

| Pattern | Matches | Examples |
|---------|---------|----------|
| `*.local` | Any subdomain of `.local` | `api.local`, `app.local`, `test.local` |
| `*.dev.local` | Any subdomain of `.dev.local` | `api.dev.local`, `auth.dev.local` |
| `api.*` | `api` with any TLD | `api.local`, `api.test`, `api.dev` |

### Route Resolution Example

```json
{
  "routes": {
    "api.local": {"target": "http://localhost:3001"},
    "*.local": {"target": "http://localhost:8000"},
    "*.dev.local": {"target": "http://localhost:9000"}
  }
}
```

**Resolution order:**
- `api.local` → `http://localhost:3001` (exact match)
- `app.local` → `http://localhost:8000` (wildcard match)
- `api.dev.local` → `http://localhost:9000` (more specific wildcard)

## 🔄 File Rotation API

### Log Rotation Mechanics

**File Naming Convention:**
```
proxy.log      <- Current log file
proxy.log.1    <- Most recent rotated file
proxy.log.2    <- Second most recent
...
proxy.log.N    <- Oldest kept file
```

**Rotation Triggers:**
- File size exceeds `maxFileSize`
- Manual rotation (future feature)

**Rotation Process:**
1. Close current log file
2. Rename `proxy.log` → `proxy.log.1`
3. Rename `proxy.log.1` → `proxy.log.2` (etc.)
4. Delete oldest file if `maxFiles` exceeded
5. Create new `proxy.log`

### Size Calculation

```javascript
// File size helpers
const MB = 1024 * 1024;
const GB = 1024 * MB;

// Example configurations
const config = {
  maxFileSize: 10 * MB,    // 10MB
  maxFiles: 5              // Keep 5 files = ~50MB total
};
```

## 🛡 Security Considerations

### Data Sanitization

**Automatic Sanitization:**
- Sensitive headers are masked in all log outputs
- Request/response bodies are size-limited (1MB default)
- Binary content is detected and replaced with placeholder

**Manual Sanitization:**
```javascript
// Custom sensitive header patterns
const sensitivePatterns = [
  /authorization/i,
  /x-api-key/i,
  /cookie/i,
  /token/i
];
```

### Access Control

**WebSocket Access:**
- No authentication required (local development tool)
- Listens only on localhost by default
- Consider firewall rules for network access

**File System Access:**
- Log files written with process permissions
- Config files readable by process user
- No privilege escalation required

## 🔧 Integration Examples

### Monitoring Integration

**Prometheus Metrics (Conceptual):**
```javascript
// Future feature - metrics endpoint
GET http://localhost:8089/metrics

// Example metrics
proxy_requests_total{domain="api.local",method="GET",status="200"} 145
proxy_request_duration_seconds{domain="api.local"} 0.045
proxy_routes_configured 5
proxy_routes_enabled 4
```

**Log Aggregation:**
```bash
# Ship logs to external systems
proxy-server logs --format json | \
  jq -c . | \
  curl -X POST -H "Content-Type: application/json" \
    --data-binary @- \
    http://logserver:9200/proxy-logs/_doc
```

### Health Check Integration

**Proxy Health Check:**
```bash
# Check if proxy is responding
curl -f http://localhost:8080/ && echo "Proxy OK" || echo "Proxy Down"

# Check specific route health
curl -f -H "Host: api.local" http://localhost:8080/health
```

**Service Discovery:**
```javascript
// Auto-register services with proxy
const services = await discoverServices();
for (const service of services) {
  await exec(`proxy-server add ${service.domain} ${service.url}`);
}
```

---

This API reference covers all programmatic interfaces. For CLI usage, see the main README.md documentation.