import * as vscode from 'vscode';
import { SuperLogViewProvider } from './webview/SuperLogViewProvider';
import { createDebugAdapterTrackerFactory } from './debugAdapter/debugAdapterTracker';

export function activate(context: vscode.ExtensionContext) {
    console.log('EXT: SuperLog is now active!'); // Look for this in PARENT window

    const provider = new SuperLogViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('superlog.logView', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Add command to focus the view
    context.subscriptions.push(
        vscode.commands.registerCommand('strucdbg.showLogs', () => {
            vscode.commands.executeCommand('superlog.logView.focus');
        })
    );

    const trackerFactory = createDebugAdapterTrackerFactory(provider);
    vscode.debug.registerDebugAdapterTrackerFactory('*', trackerFactory);
}

export function deactivate() {}
