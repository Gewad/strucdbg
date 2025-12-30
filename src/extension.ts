import * as vscode from 'vscode';
import { SuperLogViewProvider } from './webview/SuperLogViewProvider';
import { createDebugAdapterTrackerFactory } from './debugAdapter/debugAdapterTracker';
import { WebviewWindowManager } from './webview/windowManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('EXT: SuperLog is now active!'); // Look for this in PARENT window

    // Instantiate the WindowManager and pass it into the provider so it
    // can hand off the concrete webview when it resolves.
    const windowManager = new WebviewWindowManager();
    const provider = new SuperLogViewProvider(context.extensionUri, windowManager);
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

    // Track debug session starts
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession((session) => {
            console.log('[Extension] Debug session started:', session.name, 'id:', session.id);
            windowManager.notifyNewSession(session.id, session.name);
        })
    );

    // Track debug session terminations
    context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession((session) => {
            console.log('[Extension] Debug session terminated:', session.name, 'id:', session.id);
            windowManager.notifySessionEnded(session.id);
        })
    );

    const trackerFactory = createDebugAdapterTrackerFactory(windowManager);
    vscode.debug.registerDebugAdapterTrackerFactory('*', trackerFactory);
}

export function deactivate() {}
