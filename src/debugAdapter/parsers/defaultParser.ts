import { LogParser } from './logParser';
import { StructuredLogPayload } from '../../webview/windowManager';
import { normalizeSeverity } from './parserUtils';

export const defaultParser: LogParser = {
    parse(message: Record<string, unknown>): StructuredLogPayload | null {
        // If message has a 'text' or similar top-level string, treat that as the display message
        const maybeText = message['text'] ?? message['msg'] ?? message['message'] ?? message['event'] ?? message['ev'];
        if (typeof maybeText === 'string' && Object.keys(message).length === 1) {
            return {
                severity: 'info',
                message: maybeText,
                timestamp: new Date().toISOString(),
            };
        }

        if (typeof message === 'object' && message !== null) {
            const rawSeverity = (message['severity'] ?? message['level'] ?? message['lvl'] ?? message['levelname']) as any;
            const msg = (message['message'] ?? message['msg'] ?? message['event'] ?? message['text'] ?? message['msgstr']) as any;

            const payload: StructuredLogPayload = {
                severity: normalizeSeverity(rawSeverity),
                message: typeof msg === 'string' ? msg : JSON.stringify(msg),
                operation_id: message['operation_id'] as string | undefined,
                timestamp: (message['timestamp'] as any) ?? new Date().toISOString(),
            };

            return payload;
        }

        return null;
    }
};

export default defaultParser;
