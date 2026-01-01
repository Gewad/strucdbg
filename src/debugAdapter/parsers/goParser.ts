// Parse a Go runtime stack string into the exception structure expected by the webview.
// Example Go stack string:
// goroutine 1 [running]:
// runtime/debug.Stack()
//	/Users/.../runtime/debug/stack.go:26 +0x64
// main.main()
//	/Users/.../main.go:50 +0xf60
import { LogParser } from './logParser';
import { ExceptionPayload, StructuredLogPayload, StackFrame } from '../../webview/windowManager';
import { normalizeSeverity } from './parserUtils';

export function parseGoStack(stack: string): ExceptionPayload[] | null {
    if (stack === '') {
        return null;
    }

    const lines = stack.split(/\r?\n/);

    // First non-empty line often contains goroutine info
    let idx = 0;
    while (idx < lines.length && lines[idx].trim() === '') {
        idx++;
    }
    const firstLine = idx < lines.length ? lines[idx].trim() : 'goroutine';
    // Advance past the goroutine header if present
    if (firstLine.startsWith('goroutine')) {
        idx++;
    }

    const frames: StackFrame[] = [];

    while (idx < lines.length) {
        const funcLine = lines[idx].trim();
        if (!funcLine) { idx++; continue; }

        const next = (idx + 1) < lines.length ? lines[idx + 1] : null;
        if (next && next.startsWith('\t')) {
            const fileLine = next.trim();
            // fileLine format: /path/to/file.go:123 +0xabc  (offset optional)
            const m = fileLine.match(/^(.*):(\d+)(?:\s+\+0x[0-9a-fA-F]+)?$/);
            if (m) {
                const filename = m[1];
                const lineno = parseInt(m[2], 10);
                frames.push({ filename, lineno, name: funcLine, locals: {} });
                idx += 2;
                continue;
            }
        }

        // If we can't parse a file line, still include the function name
        frames.push({ filename: '<unknown>', lineno: 0, name: funcLine, locals: {} });
        idx++;
    }

    return [{
        exc_type: 'GoStack',
        exc_value: firstLine,
        is_cause: false,
        frames
    }];
}

const stacktraceKeys = ['stack', 'stacktrace'];
const severityKeys = ['severity', 'level', 'lvl'];
const messageKeys = ['message', 'msg', 'event', 'text'];
const timestampKeys = ['timestamp', 'time'];

export const goParser: LogParser = {
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
        const exc = parseGoStack(stackStr);

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

        let timestampIso: string | undefined;
        for (const key of timestampKeys) {
            if (message[key] !== undefined) {
                const val = message[key];
                console.log('Found timestamp key in Go log parser:', key, "type:", typeof val, 'value:', val);
                delete message[key];
                if (typeof val === 'number') {
                    timestampIso = new Date(val).toISOString();
                } else if (typeof val === 'string') {
                    timestampIso = new Date(val).toISOString();
                }
                break;
            }
        }
        if (!timestampIso) {
            timestampIso = new Date().toISOString();
        }

        const payload: StructuredLogPayload = {
            severity,
            message: rawMessage as string,
            exception: exc ?? undefined,
            metadata: {...message},
            operation_id: message['operation_id'] as string | undefined,
            // include current time as timestamp formatted as a string
            timestamp: timestampIso,
        };

        return payload;
    }
};

export default goParser;
