# 📝 Changelog

All notable changes to hop2it will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

### 🎉 Initial Release

#### ✨ Added
- **Core Proxy Functionality**
  - Domain-based HTTP request routing
  - Wildcard domain support (e.g., `*.dev.local`)
  - Hot-reloadable JSON configuration
  - Request/response proxying with timeout handling

- **Request Tracing System**
  - Automatic trace ID generation for all requests
  - Support for existing trace ID headers (`x-trace-id`, `x-request-id`, etc.)
  - Request lifecycle tracking with timestamps
  - Cross-service request correlation

- **Advanced Logging**
  - Configurable log levels (none, error, warn, info, debug)
  - Per-route and global logging configuration
  - Colorized console output with timestamps
  - Optional request/response headers and body logging
  - Smart sensitive data masking for security

- **Log File Management**
  - Automatic log file rotation with configurable size limits
  - Configurable retention policy (number of files to keep)
  - JSON-structured log format for easy parsing
  - Real-time log streaming via WebSocket

- **Interactive Interfaces**
  - Full-featured Terminal User Interface (TUI) for configuration
  - WebSocket-based live log viewing for multiple clients
  - Command-line interface with comprehensive route management
  - Pretty-printed and JSON log output formats

- **Configuration Management**
  - Hot-reloadable configuration without service restart
  - CLI overrides for all configuration options
  - Configuration validation and error handling
  - Automatic configuration file creation with defaults

#### 🛡 Security Features
- **Smart Data Masking**
  - Automatic detection and masking of sensitive headers
  - Preserves authorization types (Bearer, Basic, etc.) while masking tokens
  - Configurable masking rules showing first 25% of sensitive values (max 8 chars)
  - Support for common sensitive headers (authorization, cookies, API keys)

- **Safe Logging**
  - Request/response body size limits (1MB default)
  - Binary content detection and placeholder replacement
  - Automatic sensitive header sanitization
  - Secure log file permissions

#### 🎨 User Experience
- **Colorized Output**
  - HTTP method color coding (GET=green, POST=blue, etc.)
  - Status code color coding (2xx=green, 4xx=yellow, 5xx=red)
  - Response time color coding (fast=green, slow=red)
  - Domain-specific consistent coloring

- **Rich Console Interface**
  - Millisecond-precision timestamps with timezone
  - Request/response correlation with trace IDs
  - Hierarchical log formatting for headers and bodies
  - Visual status indicators (✓ enabled, ✗ disabled)

#### ⚙️ CLI Commands
- `proxy-server start` - Start the proxy server
- `proxy-server add <domain> <target>` - Add a new route
- `proxy-server remove <domain>` - Remove a route
- `proxy-server list` - List all configured routes
- `proxy-server enable/disable <domain>` - Toggle routes
- `proxy-server config` - Launch interactive TUI
- `proxy-server logs` - View live log stream
- `proxy-server tail <file>` - Tail log files
- `proxy-server set-logging <level>` - Configure logging levels

#### 📊 Monitoring & Observability
- **Real-time Metrics**
  - Request count and response time tracking
  - Error rate monitoring with status code tracking
  - Per-domain and global statistics
  - Request method distribution

- **Multi-client Log Streaming**
  - WebSocket-based log distribution
  - Filtering by log level, domain, and format
  - Historical log replay from memory buffer
  - JSON and pretty-print output formats

#### 🔧 Developer Experience
- **Hot Configuration Reload**
  - File system watching for automatic config updates
  - Zero-downtime configuration changes
  - Configuration validation with error reporting
  - CLI-driven configuration updates

- **Comprehensive Documentation**
  - Detailed README with setup instructions
  - API reference for WebSocket and configuration interfaces
  - Usage examples for common development workflows
  - Troubleshooting guide with common issues

#### 🏗 Architecture
- **TypeScript Implementation**
  - Full type safety throughout the codebase
  - Modular architecture with clear separation of concerns
  - Event-driven configuration management
  - Extensible plugin architecture foundation

- **Performance Optimizations**
  - Efficient request proxying with minimal overhead
  - Memory-bounded log buffering
  - Optimized WebSocket broadcasting
  - Configurable timeout and retry handling

#### 📦 Dependencies
- `blessed` - Terminal User Interface framework
- `chalk` - Terminal color styling
- `commander` - CLI argument parsing
- `http-proxy-middleware` - HTTP proxying functionality
- `ws` - WebSocket server implementation

### 🔄 Configuration Schema
```json
{
  "routes": {
    "<domain>": {
      "target": "string",
      "enabled": "boolean", 
      "logging": "LogLevel",
      "logRequestHeaders": "boolean",
      "logRequestBody": "boolean", 
      "logResponseHeaders": "boolean",
      "logResponseBody": "boolean"
    }
  },
  "global": {
    "port": "number",
    "logging": "LogLevel", 
    "tracing": "boolean",
    "logRequestHeaders": "boolean",
    "logRequestBody": "boolean",
    "logResponseHeaders": "boolean", 
    "logResponseBody": "boolean",
    "logRotation": {
      "maxFileSize": "number",
      "maxFiles": "number",
      "compress": "boolean"
    }
  }
}
```

### 🎯 Use Cases Supported
- **Local Development**
  - Microservices development with domain routing
  - API debugging with detailed request/response logging  
  - Frontend/backend integration testing
  - Service mocking and testing

- **Team Collaboration**
  - Shared development environment configuration
  - Real-time log streaming for debugging sessions
  - Consistent local environment setup
  - API integration testing

- **Production Support**
  - Staging environment request routing
  - Integration testing with comprehensive logging
  - Performance monitoring and debugging
  - Request tracing across service boundaries

---

## 🚀 Future Releases

### Planned Features (v1.1.0)
- [ ] HTTPS/TLS certificate handling
- [ ] Load balancing across multiple targets
- [ ] Request/response transformation middleware
- [ ] Metrics endpoint for monitoring integration
- [ ] Authentication and rate limiting
- [ ] Configuration API for programmatic management

### Under Consideration (v2.0.0)
- [ ] GraphQL proxy support
- [ ] WebSocket proxying
- [ ] Circuit breaker functionality  
- [ ] Request caching layer
- [ ] Plugin system for custom middleware
- [ ] Distributed tracing integration (OpenTelemetry)

---

**Legend:**
- ✨ Added - New features
- 🛡 Security - Security improvements
- 🎨 UI/UX - User interface and experience improvements
- ⚙️ CLI - Command-line interface changes
- 📊 Monitoring - Observability and monitoring features
- 🔧 Developer - Developer experience improvements
- 🏗 Architecture - Internal architecture changes
- 📦 Dependencies - Dependency updates
- 🔄 Configuration - Configuration schema changes
- 🎯 Use Cases - Supported use cases and workflows