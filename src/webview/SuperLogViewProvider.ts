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
                let html = fs.readFileSync(htmlPath, 'utf8');

                // Read inline SVG contents for expected severities and inject them
                // into the HTML. Inline SVGs can inherit `currentColor` so their
                // color will match surrounding text when the SVG uses `fill="currentColor"` or `stroke="currentColor"`.
                const severities = ['debug', 'info', 'warning', 'error', 'critical'];
                const svgMap: Record<string, string> = {};

                for (const s of severities) {
                    // Try src (dev) first, then dist (built)
                    const candidates = [
                        path.join(this._extensionUri.fsPath, 'src', 'webview', 'assets', `${s}.svg`),
                        path.join(this._extensionUri.fsPath, 'dist', 'webview', 'assets', `${s}.svg`)
                    ];
                    for (const p of candidates) {
                        try {
                            if (fs.existsSync(p)) {
                                let svg = fs.readFileSync(p, 'utf8');
                                // Strip XML prolog if present to avoid duplication when injected
                                svg = svg.replace(/^\s*<\?xml[^>]*>\s*/i, '');
                                svgMap[s] = svg;
                                break;
                            }
                        } catch (e) {
                            // ignore and try next
                        }
                    }
                }

                // Update Content-Security-Policy to allow inline SVGs and keep inline scripts/styles.
                try {
                    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">`;
                    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, cspMeta);
                } catch (e) {
                    // ignore
                }

                // Inject SVGs (raw markup) into the HTML so the webview can render them inline.
                const injection = `\n<script>window.__ICON_SVGS__ = ${JSON.stringify(svgMap)};</script>\n`;
                html = html.replace(/<\/head>/i, injection + '</head>');

                return html;
            }
        }

        console.error('[ViewProvider] Could not find HTML file in any expected location');
        return '<html><body><h1>Error: Could not load webview</h1></body></html>';
    }
}