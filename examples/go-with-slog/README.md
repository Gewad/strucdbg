# Go with slog Example

This example demonstrates structured logging in Go using the built-in `log/slog` package with JSON output.

## Features

- JSON formatted logs to stdout
- Multiple log levels (Debug, Info, Warn, Error)
- Structured fields with key-value pairs
- Operation grouping using `operation_id`
- Nested error propagation
- Continuous logging loop

## Running

1. Open this folder in VS Code
2. Press F5 or go to Run and Debug
3. Select "Launch Go" configuration
4. View structured logs in the Strucdbg extension panel

## What to expect

- Basic logs at different severity levels
- Grouped operations with the same `operation_id`
- Nested error messages
- Continuous loop logs every 2 seconds (stops after 5 iterations)
