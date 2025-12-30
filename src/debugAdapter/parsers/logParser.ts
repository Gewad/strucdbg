import { StructuredLogPayload } from '../../webview/windowManager';

export interface LogParser {
    // Parse a parsed JSON message (object) and return a StructuredLogPayload
    // suitable for the Window Manager, or `null` if the parser can't produce one.
    parse(message: Record<string, unknown>): StructuredLogPayload | null;
}

export default LogParser;
