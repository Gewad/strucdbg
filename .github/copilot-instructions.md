## Quick orientation for AI coding agents

This repo is a small VS Code extension (TypeScript) that captures and displays structured logs from debug adapter output.
Use the files below as authoritative examples when making changes or suggesting code.

- **Build & Dev**: `package.json` scripts
  - `npm run watch` - runs `watch:tsc` and `watch:esbuild` concurrently (recommended during development).
  - `npm run compile` - runs type check, lint, then `esbuild` for a production build.
  - `npm test` - runs extension tests using `vscode-test` (see `pretest` for steps run before tests).

- **Activation & entrypoints**:
  - Extension activates on `onDebug` (see `package.json` `activationEvents`).
  - Main module: `dist/extension.js` (built from `src/extension.ts`).

- **Webview**:
  - Development HTML lives at `src/webview/superlogView.html`. The provider will load from `src/webview` in dev or `dist/webview` in production: see `src/webview/SuperLogViewProvider.ts`.
  - The webview expects messages using the `WindowManager` contract (see `src/webview/windowManager.ts`) — these types are canonical and used by parsers/adapters.

- **Parsers & debug adapter integration**:
  - Parsers implement the `LogParser` interface (`src/debugAdapter/parsers/logParser.ts`) and return a `StructuredLogPayload` (types in `src/webview/windowManager.ts`).
  - Language-specific parsers are in `src/debugAdapter/parsers/`: `goParser.ts`, `pythonParser.ts`, `defaultParser.ts`. Follow their shape when adding new parsers.
    - Export pattern: a named export (e.g. `export const goParser: LogParser = { ... }`) and a `export default goParser;` is used in the codebase.
    - Parsing conventions: prefer returning `StructuredLogPayload` with `severity`, `message`, optional `exception`, `metadata`, `operation_id`, and `timestamp`.
  - The tracker that selects parsers is `src/debugAdapter/debugAdapterTracker.ts`. It detects language from `session.type` and `configuration.program` and then selects `goParser`, `pythonParser`, or `defaultParser`.
    - If you add/rename a parser, update `debugAdapterTracker.ts` to import and choose it based on language detection.

- **Severity normalization**: use `normalizeSeverity` in `src/debugAdapter/parsers/parserUtils.ts` to convert numeric or textual levels into the canonical set `debug|info|warning|error|critical`.

- **Error & raw handling**:
  - If a parser cannot produce a `StructuredLogPayload`, the code falls back to `IWindowManager.addRawLog` — preserve this behavior when changing parser return semantics.

- **Contributing code changes**:
  - Keep TypeScript types in sync; run `npm run check-types` locally or `npm run watch` to see type errors.
  - Lint rules run with `npm run lint` against `src/`.
  - For UI changes, update `src/webview/superlogView.html` (dev) and ensure build copies it to `dist/webview` for packaging.

- **Tests & CI**:
  - Unit/integration tests are driven by `vscode-test` (`npm test`). `pretest` compiles and lints before running tests.

Examples (copy-paste safe snippets)

- Add a new parser skeleton (place in `src/debugAdapter/parsers/newLangParser.ts`):
```ts
import { LogParser } from './logParser';
import { StructuredLogPayload } from '../../webview/windowManager';

export const newLangParser: LogParser = {
  parse(message: Record<string, unknown>): StructuredLogPayload | null {
    // return { severity: 'info', message: '...', timestamp: new Date().toISOString() }
    return null;
  }
};

export default newLangParser;
```

- Hooking it into the tracker: import and map to a detected language in `createDebugAdapterTrackerFactory` inside `src/debugAdapter/debugAdapterTracker.ts`.

What not to guess
- Do not assume different `StructuredLogPayload` fields than those in `src/webview/windowManager.ts`.
- Do not change activation events or packaging paths without updating `package.json` and `SuperLogViewProvider.ts` path logic.

If anything here is unclear or you'd like the instructions to include more examples (e.g., how to add tests for parsers or how build artifacts are produced), tell me which area to expand.  
