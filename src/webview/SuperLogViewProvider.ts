import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewWindowManager } from './windowManager';

export class SuperLogViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _windowManager?: WebviewWindowManager) {}

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
        this._view = webviewView;

        // Hand off the concrete view to the window manager, if present.
        if (this._windowManager) {
            this._windowManager.attachView(webviewView);
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