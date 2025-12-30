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

export function parsePythonStack(stack: string): ExceptionPayload[] | null {
    if (stack === '') {
        return null;
    }

    const lines = stack.split(/\r?\n/);
    const frames: StackFrame[] = [];
    let i = 0;
    // Skip leading 'Traceback' line if present
    if (lines[i] && lines[i].startsWith('Traceback')) {
        i++;
    }

    while (i < lines.length) {
        const line = lines[i].trim();
        const m = line.match(/^File "?(.*)"?, line (\d+), in (.*)$/);
        if (m) {
            const filename = m[1];
            const lineno = parseInt(m[2], 10) || 0;
            const name = m[3] || '<module>';
            frames.push({ filename, lineno, name, locals: {} });
            i += 1; // advance to possible code line
            // skip the following indented code line if present
            if (i < lines.length && lines[i].match(/^\s+/)) {
                i++;
            }
            continue;
        }

        // If the line looks like an exception message, capture it as exc_value
        i++;
    }

    // Try to capture the last non-empty line as the exception message
    let excValue = '';
    for (let j = lines.length - 1; j >= 0; j--) {
        const t = lines[j].trim();
        if (t) { excValue = t; break; }
    }

    return [{
        exc_type: 'PythonTraceback',
        exc_value: excValue,
        is_cause: false,
        frames
    }];
}

const stacktraceKeys = ['stack', 'stacktrace'];
const severityKeys = ['severity', 'level', 'lvl'];
const messageKeys = ['message', 'msg', 'event', 'text'];

export const pythonParser: LogParser = {
    parse(message: Record<string, unknown>): StructuredLogPayload | null {
        // If message contains a stack-like field, try that first
        let stackStr: string = '';
        for (const key of stacktraceKeys) {
            if (typeof message[key] === 'string') {
                stackStr = message[key] as string;
                delete message[key];
                break;
            }
        }
        const exc = parsePythonStack(stackStr);

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
