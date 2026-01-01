// Parse a simple Python traceback string into a minimal exception structure.
// Example Python traceback:
// Traceback (most recent call last):
//   File "/path/to/file.py", line 10, in <module>
//     main()
//   File "/path/to/file.py", line 6, in main
//     do_work()
// ValueError: something bad
import { LogParser } from './logParser';
import { ExceptionPayload, StructuredLogPayload, StackFrame } from '../../webview/windowManager';
import { normalizeSeverity } from './parserUtils';

export function parsePythonStack(stack: any[]): ExceptionPayload[] | null {
    if (!Array.isArray(stack) || stack.length === 0) {
        return null;
    }

    let items: ExceptionPayload[] = [];
    for (const item of stack) {
        if (typeof item !== 'object' || item === null) {
            return null;
        }

        const frames: StackFrame[] = [];
        for (const frame of item.frames || []) {
            const filename = frame.filename || '<unknown>';
            const lineno = frame.lineno || 0;
            const name = frame.name || '<module>';
            frames.push({ filename, lineno, name, locals: {} });
        }

        items.push({
            exc_type: item.exc_type || 'UnknownException',
            exc_value: item.exc_value || '',
            is_cause: item.is_cause || false,
            frames
        });
    }

    if (items.length === 0) {
        return null;
    }
    return items;
}

const stacktraceKeys = ['exception'];
const severityKeys = ['severity', 'level', 'lvl'];
const messageKeys = ['message', 'msg', 'event', 'text'];

export const pythonParser: LogParser = {
    parse(message: Record<string, unknown>): StructuredLogPayload | null {
        // If message contains a stack-like field, try that first
        let stack: any[];
        let exc: ExceptionPayload[] | null = null;
        for (const key of stacktraceKeys) {
            if (message[key] === undefined) { continue; }

            stack = message[key] as any[];
            delete message[key];
            exc = parsePythonStack(stack);
            break;
        }

        // Determine severity from explicit fields when present, otherwise inspect exception text
        let severity: string;
        let rawSeverity: any = null;
        for (const key of severityKeys) {
            if (message[key] !== undefined) {
                rawSeverity = message[key];
                delete message[key];
                break;
            }
        }
        severity = normalizeSeverity(rawSeverity);

        let rawMessage: string = '';
        for (const key of messageKeys) {
            if (message[key] !== undefined) {
                const val = message[key];
                delete message[key];
                if (typeof val === 'string') {
                    rawMessage = val;
                } else {
                    rawMessage = JSON.stringify(val);
                }
                break;
            }
        }

        const payload: StructuredLogPayload = {
            severity,
            message: rawMessage as string,
            exception: exc ?? undefined,
            metadata: {...message},
            operation_id: message['operation_id'] as string | undefined,
            // include current time as timestamp formatted as a string
            timestamp: new Date().toISOString(),
        };

        return payload;
    }
};

export default pythonParser;
