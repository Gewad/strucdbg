import * as vscode from 'vscode';
import { SuperLogViewProvider } from '../webview/SuperLogViewProvider';

export function createDebugAdapterTrackerFactory(provider: SuperLogViewProvider): vscode.DebugAdapterTrackerFactory {
    return {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            console.log('[DebugAdapter] Tracker created for session:', session.name, 'id:', session.id);
            const sessionId = session.id;
            return {
                onDidSendMessage: (message) => {
                    console.log('[DebugAdapter] Message received - type:', message.type, 'event:', message.event);
                    if (message.type === 'event' && message.event === 'output') {
                        const outputText = message.body.output;
                        console.log('[DebugAdapter] Output detected, length:', outputText?.length, 'sessionId:', sessionId);
                        
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
                                    
                                    // --- NORMALIZATION STEP ---
                                    // 1. Determine Severity (fallback to 'info')
                                    //    Look for 'severity', 'level', 'lvl', or default to 'info'
                                    const rawSeverity = parsed.severity || parsed.level || parsed.lvl || 'info';
                                    
                                    // 2. Determine Message (fallback to raw JSON string if missing)
                                    //    Look for 'message', 'msg', 'event', 'text'
                                    const rawMessage = parsed.message || parsed.msg || parsed.event || parsed.text || JSON.stringify(parsed);

                                    // 3. Create the Standardized Object
                                    //    We preserve the original keys (...parsed) so you don't lose data
                                    const normalized = {
                                        ...parsed,
                                        severity: rawSeverity,
                                        message: rawMessage
                                    };
                                    console.log('[DebugAdapter] Normalized - severity:', rawSeverity, 'message:', rawMessage, 'sessionId:', sessionId);

                                    // Send to view with session ID
                                    console.log('[DebugAdapter] Calling addLog with type: structured, sessionId:', sessionId);
                                    provider.addLog(normalized, 'structured', sessionId);
                                } else {
                                    // Valid JSON but it's a primitive (like "true" or number)
                                    console.log('[DebugAdapter] JSON primitive detected, calling addLog with type: raw');
                                    provider.addLog(trimmedLine, 'raw', sessionId);
                                }
                            } catch (e) {
                                // Not JSON -> treat as raw text
                                console.log('[DebugAdapter] Not JSON, calling addLog with type: raw');
                                provider.addLog(trimmedLine, 'raw', sessionId);
                            }
                        }
                    }
                }
            };
        }
    };
}
