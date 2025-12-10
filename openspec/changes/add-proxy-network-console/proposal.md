# Change: Proxy Network Console UI

## Why
The proxy currently runs headless, making it hard to debug request/response flows, key rotation issues, or model routing problems. Users want a DevTools-like view (inspired by bscript/rep) to observe both the client→proxy and proxy→upstream legs, and to ask local AI models to explain failures or unexpected responses.

## What Changes
- Add a `--ui` mode for `xling proxy` that serves the browser UI from the same proxy host/port (no extra listener), bound to localhost by default.
- Stream structured proxy events (request, upstream call, response) to the UI with correlation IDs, timings, status, model/provider, and safe body previews.
- Provide a DevTools-style Network console UI with filtering, detail tabs, and timeline for each request, covering both proxy-facing and upstream hops.
- Integrate xling’s model router so users can select a request and ask an AI assistant to summarize errors or unknown fields using their configured providers.
- Allow exporting selected/all captured requests as a redacted HAR/JSON bundle for offline analysis or import into other tools.
- Include guardrails: redaction of secrets, bounded in-memory history, opt-in verbose payload capture, and access-key reuse for UI APIs.

## Impact
- Affected specs: proxy-observability (new).
- Affected code: `src/commands/proxy/index.ts`, `src/services/proxy/server.ts`, new proxy UI server/bootstrap, React UI under `src/ui` (or subpath), proxy tests, and docs/help text.
