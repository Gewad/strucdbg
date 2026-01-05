# Strucdbg - Structured Log Debugger

**Strucdbg** transforms the debugging experience by capturing and visualizing structured logs from your debug sessions in a clean, organized interface.

## What is Strucdbg?

When debugging modern applications that use structured logging (JSON logs from libraries like `slog`, `zap`, `structlog`, etc.), the output can be overwhelming and difficult to read. Strucdbg automatically captures these structured logs during debug sessions and presents them in a beautiful, easy-to-navigate panel.

![Strucdbg Interface](https://dev.gerards.site/assets/external_use/strucdbg/logging_simple.png)

## Key Features

### 🎯 Automatic Log Capture
- Activates automatically when you start a debug session
- No configuration required - just start debugging
- Works with Go, Python, and other languages

### 📊 Structured Log Visualization
- **Severity-based color coding**: Quickly identify errors, warnings, and info messages
- **Collapsible metadata**: Keep your view clean while preserving access to detailed context
- **Operation grouping**: Related logs with the same `operation_id` are grouped together for easy tracing
- **Timestamp display**: Track when events occurred in your application

![Strucdbg Interface](https://dev.gerards.site/assets/external_use/strucdbg/logging_operations.png)

### 🐛 Enhanced Stack Traces
- **Interactive stack traces**: Click on file paths to jump directly to the source code
- **Code preview**: Hover over stack frames to see the actual code without leaving the log view
- **Multi-level exception support**: Visualize nested exceptions and their propagation

![Strucdbg Interface](https://dev.gerards.site/assets/external_use/strucdbg/logging_stack.png)

### 🔍 Multi-Session Support
- **Tabbed interface**: Each debug session gets its own tab
- **Session hierarchy**: Child debug sessions are tracked with their parents
- **Session switching**: Easily navigate between concurrent debug sessions

### 📝 Fallback for Raw Logs
- Non-JSON output are displayed as you are used to inside of the relevant session tab
- Never lose visibility into plain text debug output

## How It Works

1. **Start debugging** your application (F5 or Run → Start Debugging)
2. **Open the Structured Logs panel** from the bottom panel (it appears automatically)
3. **Watch logs appear** in real-time as your application runs
4. **Click on stack traces** to navigate to source code
5. **Expand metadata** to see additional context

## Supported Languages

Strucdbg includes specialized parsers for:
- **Go**: `log/slog`, `zap`, and other JSON-based loggers
- **Python**: `structlog` and similar structured logging libraries
- **Other languages**: Generic JSON log support with automatic severity detection

## Perfect For

✅ Debugging microservices with distributed tracing  
✅ Analyzing application behavior with contextual logging  
✅ Troubleshooting errors with detailed exception information  
✅ Understanding log flow across multiple operations  
✅ Keeping your debug console clean and organized  

## Get Started in Seconds

1. Install the extension
2. Open a project with structured logging
3. Start a debug session that outputs JSON logs
4. View your logs in the "Structured Logs" panel, can be found in the "panel" next to Debug Console and Terminal

No configuration files, no setup wizards - just install and debug.

## Preview / Breaking Changes

This extension is currently in preview. See examples in the repository for sample projects demonstrating structured logging with Go and Python. Please understand that this project is in a very early alpha, at any point breaking changes might occur. Please see the section below on how you can help support this project.

## Support this project

### Raising issues

This project is in a very early stage of development, as such there are no end to end tests and I am only testing on my
personal machine. If any issues occur please raise them on the [Github Page](https://github.com/Gewad/strucdbg/issues),
this helps me make this extension compatible with all setups.

### Contributing

Extension development is not (yet) my expertise, as such I would appreciate feedback and code contributions on my repo.
Please feel free to fork and make changes to the repo and create pull requests. See the repository readme for more info.
