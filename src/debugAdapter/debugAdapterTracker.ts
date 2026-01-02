import * as vscode from 'vscode';
import { IWindowManager, StructuredLogPayload } from '../webview/windowManager';
import { goParser } from './parsers/goParser';
import { pythonParser } from './parsers/pythonParser';
import { defaultParser } from './parsers/defaultParser';

// Parse a Go runtime stack string into the exception structure expected by the webview.
// Example Go stack string:
// goroutine 1 [running]:
// runtime/debug.Stack()
//	/Users/.../runtime/debug/stack.go:26 +0x64
// main.main()
//	/Users/.../main.go:50 +0xf60
// Language-specific stack parsers are implemented in separate modules

export function createDebugAdapterTrackerFactory(manager: IWindowManager): vscode.DebugAdapterTrackerFactory {
    return {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            console.log('[DebugAdapter] Tracker created for session:', session.name, 'id:', session.id, 'type:', session.type);
            const sessionId = session.id;
            
            // Determine likely language for this debug session so we can parse stack strings.
            function detectLanguageFromSession(s: vscode.DebugSession) {
                const cfgAny: any = (s as any).configuration || {};
                const type = (s.type || cfgAny.type || '').toString().toLowerCase();
                const program = (cfgAny.program || cfgAny.file || '').toString();

                if (/go|delve|dlv/.test(type)) return 'go';
                if (/python/.test(type)) return 'python';
                if (/node|javascript|js/.test(type)) return 'javascript';
                if (/java/.test(type)) return 'java';
                if (/rust|codelldb|lldb/.test(type)) return 'rust';

                if (program.endsWith('.go')) return 'go';
                if (program.endsWith('.py')) return 'python';

                return s.type;
            }

            const sessionLanguage = detectLanguageFromSession(session);
            console.log('[DebugAdapter] Detected session language:', sessionLanguage, 'sessionId:', sessionId);
            return {
                onDidSendMessage: (message) => {
                    console.log('[DebugAdapter] Message received - type:', message.type, 'event:', message.event);
                    if (message.type === 'event' && message.event === 'output') {
                        const outputText = message.body.output;
                        const outputCategory = message.body.category || 'stdout';
                        console.log('[DebugAdapter] Output detected, length:', outputText?.length, 'category:', outputCategory, 'sessionId:', sessionId);
                        
                        // Determine severity based on output category
                        const defaultSeverity = outputCategory === 'stderr' ? 'error' : 'info';
                        
                        // Split on '}\n{' or '}{' to handle batched JSON objects
                        const potentialLines = outputText.split(/}\s*{/).map((part: string, idx: number, arr: string[]) => {
                            if (idx === 0 && arr.length > 1) { return part + '}'; }
                            if (idx === arr.length - 1 && arr.length > 1) { return '{' + part; }
                            if (arr.length > 1) { return '{' + part + '}'; }
                            return part;
                        });
                        
                        for (const line of potentialLines) {
                            const trimmedLine = line.trim();
                            if (!trimmedLine) { continue; }
                            
                            try {
                                const parsed = JSON.parse(trimmedLine);
                                console.log('[DebugAdapter] JSON parsed successfully, type:', typeof parsed);
                            
                                // Check if it's a valid object (and not null)
                                if (typeof parsed === 'object' && parsed !== null) {
                                    console.log('[DebugAdapter] Valid object detected, keys:', Object.keys(parsed).join(', '));

                                    // Choose parser by detected language
                                    let parser: any = defaultParser;
                                    if (sessionLanguage === 'go') {
                                        parser = goParser;
                                    } else if (sessionLanguage === 'python') {
                                        parser = pythonParser;
                                    }

                                    const payload: StructuredLogPayload | null = parser.parse(parsed);
                                    if (payload) {
                                        console.log('[DebugAdapter] Parser produced StructuredLogPayload, sending to window manager');
                                        manager.addStructuredLog(payload, sessionId);
                                        continue;
                                    }

                                    // Parser couldn't produce structured log; convert raw to structured with output category severity
                                    console.log('[DebugAdapter] Parser could not produce StructuredLogPayload, converting to structured with severity:', defaultSeverity, 'sessionId:', sessionId);
                                    const rawPayload: StructuredLogPayload = {
                                        severity: defaultSeverity,
                                        message: trimmedLine,
                                        timestamp: new Date().toISOString()
                                    };
                                    manager.addStructuredLog(rawPayload, sessionId);
                                } else {
                                    // Valid JSON but it's a primitive (like "true" or number)
                                    console.log('[DebugAdapter] JSON primitive detected, converting to structured with severity:', defaultSeverity, 'sessionId:', sessionId);
                                    const rawPayload: StructuredLogPayload = {
                                        severity: defaultSeverity,
                                        message: trimmedLine,
                                        timestamp: new Date().toISOString()
                                    };
                                    manager.addStructuredLog(rawPayload, sessionId);
                                }
                            } catch (e) {
                                // Not JSON -> convert to structured with output category severity
                                console.log('[DebugAdapter] Not JSON, converting to structured with severity:', defaultSeverity, 'sessionId:', sessionId);
                                const rawPayload: StructuredLogPayload = {
                                    severity: defaultSeverity,
                                    message: trimmedLine,
                                    timestamp: new Date().toISOString()
                                };
                                manager.addStructuredLog(rawPayload, sessionId);
                            }
                        }
                    }
                }
            };
        }
    };
}
