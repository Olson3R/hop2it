# 📚 Usage Examples

This document provides practical examples for common use cases with hop2it.

## 🚀 Getting Started Examples

### Basic Setup

```bash
# 1. Install and build
npm install && npm run build

# 2. Start the server
hop2it start

# 3. Add your first route
hop2it add api.local http://localhost:3001

# 4. Test the route
curl -H "Host: api.local" http://localhost:8080/health
```

### Host File Configuration

To use actual domain names instead of Host headers, add to your `/etc/hosts` file:

```bash
# Add to /etc/hosts
127.0.0.1 api.local
127.0.0.1 app.local
127.0.0.1 auth.local
```

Now you can use: `http://api.local:8080/endpoint`

## 🏗 Development Environment Examples

### Microservices Architecture

Setting up a complete microservices development environment:

```bash
# Start with log file rotation for development
hop2it start --log-file ./dev-logs/proxy.log --log-max-size 25 --log-max-files 10

# Authentication service
hop2it add auth.local http://localhost:3001 \
  --logging debug \
  --log-request-headers \
  --log-response-body

# User API service  
hop2it add api.local http://localhost:3002 \
  --logging info \
  --log-request-body \
  --log-response-body

# Frontend application
hop2it add app.local http://localhost:3000 \
  --logging warn

# Admin panel
hop2it add admin.local http://localhost:3003 \
  --logging info

# View the complete setup
hop2it list
```

**Expected Output:**
```
Configured routes:
==================
✓ auth.local → http://localhost:3001 (logging: debug)
    └─ Detailed logging: req-headers, res-body
✓ api.local → http://localhost:3002 (logging: info)
    └─ Detailed logging: req-body, res-body
✓ app.local → http://localhost:3000 (logging: warn)
✓ admin.local → http://localhost:3003 (logging: info)
```

### Development with Hot Reloading

```bash
# Terminal 1: Start proxy with comprehensive logging
proxy-server start --log-file ./dev.log

# Terminal 2: Monitor logs in real-time
proxy-server logs --format pretty

# Terminal 3: Work on your services
# As you add new services, add routes dynamically:
proxy-server add notifications.local http://localhost:3004 --logging debug

# The configuration will hot-reload automatically
```

## 🧪 Testing and Debugging Examples

### API Testing with Full Visibility

```bash
# Set up API route with maximum logging
proxy-server add api.test http://localhost:8080 \
  --log-request-headers \
  --log-request-body \
  --log-response-headers \
  --log-response-body \
  --logging debug

# Monitor API calls in separate terminal
proxy-server logs --domain api.test --level debug

# Make test requests
curl -X POST api.test:8080/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-123" \
  -d '{"name":"John","email":"john@test.com"}'
```

**Log Output:**
```
14:30:15.234 DEBUG [a1b2c3d4] [api.test] POST   /users → http://localhost:8080 201 78ms
14:30:15.235 DEBUG [a1b2c3d4] [api.test] Request Headers:
  content-type: application/json
  authorization: Bearer test************
  user-agent: curl/7.68.0
14:30:15.236 DEBUG [a1b2c3d4] [api.test] Request Body:
{
  "name": "John",
  "email": "john@test.com"
}
14:30:15.312 DEBUG [a1b2c3d4] [api.test] Response Headers:
  content-type: application/json
  location: /users/123
14:30:15.313 DEBUG [a1b2c3d4] [api.test] Response Body:
{
  "id": 123,
  "name": "John",
  "email": "john@test.com",
  "created_at": "2024-01-15T14:30:15Z"
}
```

### Testing Different API Versions

```bash
# Set up routes for different API versions
proxy-server add v1.api.local http://localhost:3001 --logging info
proxy-server add v2.api.local http://localhost:3002 --logging info
proxy-server add beta.api.local http://localhost:3003 --logging debug

# Test version compatibility
curl v1.api.local:8080/users/123
curl v2.api.local:8080/users/123
curl beta.api.local:8080/users/123
```

### Load Testing Setup

```bash
# Configure for load testing with minimal logging
proxy-server add load.api.local http://localhost:3001 --logging error

# Start server with log rotation for continuous testing
proxy-server start --log-file ./load-test.log --log-max-size 100 --log-max-files 50

# Run load tests while monitoring errors
proxy-server logs --domain load.api.local --level error
```

## 🎭 Mock Server Examples

### Setting Up Mock Responses

```bash
# Start a simple mock server
python3 -m http.server 8001 &

# Route requests to mock server
proxy-server add mock.api.local http://localhost:8001 \
  --logging info \
  --log-request-headers \
  --log-response-body

# Test mock responses
curl mock.api.local:8080/
```

### A/B Testing Setup

```bash
# Route 50% traffic to version A, 50% to version B
# (Manual switching for testing)

# Version A
proxy-server add test.api.local http://localhost:3001 --logging info

# Switch to version B for testing
proxy-server remove test.api.local
proxy-server add test.api.local http://localhost:3002 --logging info

# Compare responses by tailing logs
proxy-server tail ./proxy.log
```

## 🔍 Advanced Logging Examples

### Security Audit Logging

```bash
# Set up comprehensive security logging
proxy-server add secure.api.local http://localhost:3001 \
  --log-request-headers \
  --log-response-headers \
  --logging info

# Monitor authentication attempts
proxy-server logs --domain secure.api.local | grep -i auth
```

### Performance Monitoring

```bash
# Monitor response times across services
proxy-server logs --format json | jq 'select(.message | contains("ms")) | {timestamp, domain: .domain, message}'

# Track slow requests (using response time colors in pretty format)
proxy-server logs --format pretty | grep -E "(red|slow)"
```

### Error Tracking

```bash
# Monitor errors across all services
proxy-server logs --level error

# Track specific error patterns
proxy-server logs --format json | jq 'select(.level == "error" and (.data.statusCode >= 500))'
```

## 🌐 Production-like Examples

### Staging Environment Setup

```bash
# Set up staging environment with log rotation
proxy-server start --log-file ./staging/proxy.log \
  --log-max-size 50 --log-max-files 20

# Add staging services
proxy-server add api.staging.local http://localhost:4000 --logging info
proxy-server add auth.staging.local http://localhost:4001 --logging warn
proxy-server add cdn.staging.local http://localhost:4002 --logging error

# Monitor staging traffic
proxy-server logs --level info
```

### Integration Testing

```bash
# Set up for integration testing
proxy-server add integration.api.local http://localhost:5000 \
  --log-request-body \
  --log-response-body \
  --logging debug

# Run integration tests while logging
npm run integration-tests &
proxy-server logs --domain integration.api.local --format json > integration-logs.json
```

## 🎨 Interactive TUI Examples

### Using the Configuration TUI

```bash
# Launch the interactive configuration interface
proxy-server config
```

**TUI Workflow:**
1. Navigate with arrow keys or `j`/`k`
2. Press `a` to add a new route
3. Enter domain: `new-service.local`
4. Enter target: `http://localhost:3005`
5. Press `e` to edit the selected route
6. Choose logging level and options
7. Press `t` to toggle route on/off
8. Press `g` to edit global settings
9. Press `q` to quit

### Bulk Configuration via TUI

1. Start TUI: `proxy-server config`
2. Add multiple routes quickly using `a` key
3. Use `g` to set global logging preferences
4. Use `r` to refresh and see changes
5. Configuration auto-saves and hot-reloads

## 📊 Monitoring and Observability Examples

### Multi-Terminal Monitoring Setup

```bash
# Terminal 1: Run the proxy server
proxy-server start --log-file ./app.log

# Terminal 2: Monitor all traffic
proxy-server logs

# Terminal 3: Monitor specific service
proxy-server logs --domain api.local --level debug

# Terminal 4: Monitor errors only
proxy-server logs --level error

# Terminal 5: JSON logs for processing
proxy-server logs --format json > processed-logs.json
```

### Log Analysis Scripts

```bash
# Count requests per domain
proxy-server logs --format json | jq -r '.domain' | sort | uniq -c

# Average response times
proxy-server logs --format json | jq -r 'select(.data.duration) | .data.duration' | awk '{sum+=$1; n++} END {print sum/n}'

# Error rate calculation
total=$(proxy-server logs --format json | wc -l)
errors=$(proxy-server logs --format json | jq -r 'select(.level == "error")' | wc -l)
echo "Error rate: $(echo "scale=2; $errors * 100 / $total" | bc)%"
```

### WebSocket Streaming for Teams

```bash
# Team member 1: Frontend developer
proxy-server logs --domain app.local --level info

# Team member 2: Backend developer  
proxy-server logs --domain api.local --level debug

# Team member 3: DevOps monitoring
proxy-server logs --level error --format json

# Team lead: Overview of all services
proxy-server logs --format pretty
```

## 🛠 Development Team Workflows

### Onboarding New Developers

```bash
# 1. Clone the project configuration
git clone <project-repo>
cd <project>

# 2. Start the proxy with team config
proxy-server start --config ./team-proxy-config.json

# 3. Verify all services are configured
proxy-server list

# 4. Test connectivity
curl app.local:8080/health
curl api.local:8080/health
curl auth.local:8080/health
```

### Shared Configuration Management

**team-proxy-config.json:**
```json
{
  "routes": {
    "app.local": {
      "target": "http://localhost:3000",
      "logging": "info",
      "enabled": true
    },
    "api.local": {
      "target": "http://localhost:3001", 
      "logging": "debug",
      "enabled": true,
      "logRequestHeaders": true,
      "logResponseBody": true
    },
    "auth.local": {
      "target": "http://localhost:3002",
      "logging": "warn",
      "enabled": true,
      "logRequestHeaders": true
    }
  },
  "global": {
    "port": 8080,
    "logging": "info",
    "tracing": true,
    "logRotation": {
      "maxFileSize": 52428800,
      "maxFiles": 10
    }
  }
}
```

### Service Discovery Patterns

```bash
# Wildcard routing for dynamic services
proxy-server add "*.service.local" http://localhost:8000 --logging info

# Now any subdomain routes to the service discovery endpoint:
# auth.service.local -> http://localhost:8000
# users.service.local -> http://localhost:8000  
# orders.service.local -> http://localhost:8000
```

## 🎯 Troubleshooting Examples

### Debug Connection Issues

```bash
# Enable debug logging globally
proxy-server set-logging debug

# Check if target services are running
proxy-server logs --level error | grep "ECONNREFUSED"

# Test direct connection
curl http://localhost:3001/health  # Direct to service
curl api.local:8080/health         # Through proxy
```

### Performance Debugging

```bash
# Monitor slow requests
proxy-server logs | grep -E "[0-9]{3,}ms"  # Requests over 100ms

# Check proxy overhead
time curl api.local:8080/fast-endpoint      # Through proxy
time curl localhost:3001/fast-endpoint      # Direct connection
```

### Configuration Validation

```bash
# Validate configuration syntax
proxy-server config --json | python -m json.tool

# Check route accessibility
proxy-server list | grep "✗"  # Find disabled routes

# Test route resolution
nslookup api.local  # If using /etc/hosts
```

---

These examples cover the most common use cases and workflows. For more specific scenarios, combine these patterns or refer to the main README for detailed configuration options.