import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SuperLogViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    // Keep track of known debug sessions so the webview can be informed
    // when it initializes (in case sessions started while the view was closed)
    private _knownSessions: Map<string, string> = new Map();

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
        this._view = webviewView;

        // Inform the webview of any sessions that were started while it was closed
        if (this._knownSessions.size > 0) {
            console.log('[ViewProvider] Notifying webview of known sessions:', Array.from(this._knownSessions.keys()).join(', '));
            for (const [sessionId, sessionName] of this._knownSessions.entries()) {
                this._view.webview.postMessage({ type: 'new-session', sessionId, sessionName });
            }
        }
        
        // Send a test message to confirm webview is working
        setTimeout(() => {
            console.log('[ViewProvider] Sending test message to webview');
            this.addLog('Webview initialized and ready', 'raw');
        }, 100);

        // Listen for messages from the Frontend (The REPL input)
        webviewView.webview.onDidReceiveMessage(async data => {
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
            } else if (data.type === 'openFile') {
                // Open file at specific line from exception traceback
                const fileUri = vscode.Uri.file(data.file);
                vscode.window.showTextDocument(fileUri, {
                    selection: new vscode.Range(data.line - 1, 0, data.line - 1, 0),
                    preview: false
                });
            } else if (data.type === 'getCodeLine') {
                // Fetch code line and send back to webview
                console.log('[ViewProvider] Getting code line:', data.file, 'line:', data.line, 'requestId:', data.requestId);
                try {
                    const fileUri = vscode.Uri.file(data.file);
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const lineIndex = data.line - 1;
                    if (lineIndex >= 0 && lineIndex < document.lineCount) {
                        const line = document.lineAt(lineIndex);
                        const codeText = line.text.trimStart(); // Remove leading whitespace
                        console.log('[ViewProvider] Sending code line for requestId:', data.requestId, 'code:', codeText.substring(0, 50));
                        webviewView.webview.postMessage({
                            type: 'code-line',
                            requestId: data.requestId,
                            code: codeText
                        });
                    } else {
                        console.log('[ViewProvider] Line out of range for requestId:', data.requestId);
                        webviewView.webview.postMessage({
                            type: 'code-line',
                            requestId: data.requestId,
                            code: null
                        });
                    }
                } catch (error) {
                    console.error('[ViewProvider] Error loading code line:', error, 'requestId:', data.requestId);
                    webviewView.webview.postMessage({
                        type: 'code-line',
                        requestId: data.requestId,
                        code: null
                    });
                }
            }
        });
    }

    public addLog(data: any, type: 'structured' | 'raw' | 'error', sessionId?: string) {
        console.log('[ViewProvider] addLog called - type:', type, 'sessionId:', sessionId, 'view exists:', !!this._view);
        if (this._view) {
            console.log('[ViewProvider] Posting message to webview');
            this._view.webview.postMessage({ type: 'new-log', logType: type, content: data, sessionId });
        } else {
            // If the view isn't initialized yet, just log locally and keep a record
            console.log('[ViewProvider] WARNING: View not initialized, message will be lost unless the session is replayed');
        }
    }

    public notifyNewSession(sessionId: string, sessionName: string) {
        console.log('[ViewProvider] New debug session started:', sessionName, 'id:', sessionId);
        // Remember the session so that if the webview isn't open yet we can
        // notify it when it initializes.
        this._knownSessions.set(sessionId, sessionName);
        if (this._view) {
            this._view.webview.postMessage({ type: 'new-session', sessionId, sessionName });
        }
    }

    public notifySessionEnded(sessionId: string) {
        console.log('[ViewProvider] Debug session ended:', sessionId);
        if (this._view) {
            this._view.webview.postMessage({ type: 'session-ended', sessionId });
        }
        // Keep ended sessions in known list for a short while; remove to avoid memory leak
        if (this._knownSessions.has(sessionId)) {
            // Marked ended - we still keep the name for potential replay, but remove after a delay
            setTimeout(() => {
                this._knownSessions.delete(sessionId);
            }, 5 * 60 * 1000); // remove after 5 minutes
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