# strucdbg

Structured Log Debugger - A VS Code extension for debugging structured logs.

## Features

This extension provides a "Hello World" command to demonstrate the basic VSCode extension functionality.

- Command: `Hello World` - Displays a "Hello World" message

## Getting Started

1. Open this project in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new window, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
4. Type "Hello World" and select the command
5. You should see a message "Hello World from strucdbg!"

## Development

### Building the Extension

```bash
npm run compile
```

### Running Tests

```bash
npm test
```

### Packaging the Extension

```bash
npm run package
```

## Project Structure

- `src/extension.ts` - Main extension entry point
- `package.json` - Extension manifest
- `.vscode/` - VS Code configuration for debugging

## Requirements

- VS Code 1.106.1 or higher
- Node.js and npm
