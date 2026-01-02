import * as vscode from 'vscode';
import { WebviewView } from 'vscode';

export type TabId = string;

// Contract types for structured logs — windowManager owns these so the
// parsers and adapters can import the canonical definitions.
export type Severity = 'debug' | 'info' | 'warning' | 'error' | 'critical' | string;

export interface StackFrame {
    filename: string;
    lineno: number;
    name?: string;
    locals?: Record<string, unknown>;
}

export interface ExceptionPayload {
    exc_type?: string;
    exc_value?: string;
    is_cause?: boolean;
    frames?: StackFrame[];
}

export interface StructuredLogPayload {
    // Minimal required fields for display
    severity: Severity;
    message: string;
    metadata?: Record<string, unknown>;
    operation_id?: string;

    // Optional, language-agnostic exception descriptions
    exception?: ExceptionPayload[];

    // Raw stack string if parsing failed or for unknown languages
    stack?: string;

    timestamp?: string;
}

export interface IWindowManager {
    addStructuredLog(payload: StructuredLogPayload, tabId: TabId): void;
    addRawLog(text: string, tabId: TabId): void;
    addError(text: string, tabId: TabId): void;
    notifyNewSession(sessionId: string, sessionName: string): void;
    notifySessionEnded(sessionId: string): void;
}

// Thin wrapper around the StrucdbgViewProvider that exposes a small,
// explicit interface for the rest of the application. Every operation
// requires a `tabId` so the window manager doesn't need to infer session
// state or routing logic.
export class WebviewWindowManager implements IWindowManager {
    private _view?: vscode.WebviewView;
    private _knownSessions: Map<string, string> = new Map();

    constructor() {}

    // Attach a webview to the manager so it can post messages and listen
    // for frontend requests. Called by the provider when the view resolves.
    public attachView(view: vscode.WebviewView) {
        console.log('[WindowManager] Attaching webview');
        this._view = view;

        // Make sure scripts can run (provider also sets this but it's safe)
        this._view.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(process.cwd())]
        };

        // Inform the webview of known sessions
        if (this._knownSessions.size > 0) {
            for (const [sessionId, sessionName] of this._knownSessions.entries()) {
                this.postMessage({ type: 'new-session', sessionId, sessionName });
            }
        }

        // Listen for frontend messages and handle them here
        this._view.webview.onDidReceiveMessage(async data => {
            if (!data || !data.type) return;
            try {
                if (data.type === 'evaluate') {
                    const session = vscode.debug.activeDebugSession;
                    if (session) {
                        session.customRequest('evaluate', {
                            expression: data.value,
                            context: 'repl'
                        });
                    } else {
                        this.addError('No active debug session.', 'internal');
                    }
                } else if (data.type === 'openFile') {
                    const fileUri = vscode.Uri.file(data.file);
                    vscode.window.showTextDocument(fileUri, {
                        selection: new vscode.Range(data.line - 1, 0, data.line - 1, 0),
                        preview: false
                    });
                } else if (data.type === 'getCodeLine') {
                    console.log('[WindowManager] Getting code line:', data.file, 'line:', data.line, 'requestId:', data.requestId);
                    try {
                        const fileUri = vscode.Uri.file(data.file);
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        const lineIndex = data.line - 1;
                        if (lineIndex >= 0 && lineIndex < document.lineCount) {
                            const line = document.lineAt(lineIndex);
                            const codeText = line.text.trimStart();
                            this.postMessage({ type: 'code-line', requestId: data.requestId, code: codeText });
                        } else {
                            this.postMessage({ type: 'code-line', requestId: data.requestId, code: null });
                        }
                    } catch (error) {
                        console.error('[WindowManager] Error loading code line:', error, 'requestId:', data.requestId);
                        this.postMessage({ type: 'code-line', requestId: data.requestId, code: null });
                    }
                }
            } catch (err) {
                console.error('[WindowManager] Error handling message from webview:', err);
            }
        });
    }

    private postMessage(msg: any) {
        if (this._view) {
            this._view.webview.postMessage(msg);
        } else {
            console.log('[WindowManager] No view attached — dropping message', msg.type || '');
        }
    }

    public addStructuredLog(payload: StructuredLogPayload, tabId: TabId) {
        this.postMessage({ type: 'new-log', logType: 'structured', content: payload, sessionId: tabId });
    }

    public addRawLog(text: string, tabId: TabId) {
        this.postMessage({ type: 'new-log', logType: 'raw', content: text, sessionId: tabId });
    }

    public addError(text: string, tabId: TabId) {
        this.postMessage({ type: 'new-log', logType: 'error', content: text, sessionId: tabId });
    }

    public notifyNewSession(sessionId: string, sessionName: string) {
        console.log('[WindowManager] New debug session:', sessionName, 'id:', sessionId);
        this._knownSessions.set(sessionId, sessionName);
        this.postMessage({ type: 'new-session', sessionId, sessionName });
    }

    public notifySessionEnded(sessionId: string) {
        console.log('[WindowManager] Debug session ended:', sessionId);
        this.postMessage({ type: 'session-ended', sessionId });
        if (this._knownSessions.has(sessionId)) {
            setTimeout(() => this._knownSessions.delete(sessionId), 5 * 60 * 1000);
        }
    }
}
