import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SuperLogViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('[ViewProvider] resolveWebviewView called - initializing view');
        this._view = webviewView;

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        console.log('[ViewProvider] HTML set, webview should be ready');
        
        // Send a test message to confirm webview is working
        setTimeout(() => {
            console.log('[ViewProvider] Sending test message to webview');
            this.addLog('Webview initialized and ready', 'raw');
        }, 100);

        // Listen for messages from the Frontend (The REPL input)
        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'evaluate') {
                const session = vscode.debug.activeDebugSession;
                if (session) {
                    // Send command to the actual debugger
                    session.customRequest('evaluate', { 
                        expression: data.value,
                        context: 'repl' // Treat as REPL input
                    });
                } else {
                    this.addLog("No active debug session.", 'error');
                }
            }
        });
    }

    public addLog(data: any, type: 'structured' | 'raw' | 'error') {
        console.log('[ViewProvider] addLog called - type:', type, 'view exists:', !!this._view);
        if (this._view) {
            console.log('[ViewProvider] Posting message to webview');
            this._view.webview.postMessage({ type: 'new-log', logType: type, content: data });
        } else {
            console.log('[ViewProvider] WARNING: View not initialized, message lost');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Try to load from src/ first (development), then from dist/ (production)
        const possiblePaths = [
            path.join(this._extensionUri.fsPath, 'src', 'webview', 'superlogView.html'),
            path.join(this._extensionUri.fsPath, 'dist', 'webview', 'superlogView.html')
        ];

        for (const htmlPath of possiblePaths) {
            if (fs.existsSync(htmlPath)) {
                console.log('[ViewProvider] Loading HTML from:', htmlPath);
                return fs.readFileSync(htmlPath, 'utf8');
            }
        }

        console.error('[ViewProvider] Could not find HTML file in any expected location');
        return '<html><body><h1>Error: Could not load webview</h1></body></html>';
    }
}