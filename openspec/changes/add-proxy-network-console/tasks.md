## 1. Proxy event capture
- [x] 1.1 Add structured event objects for proxy requests (client→proxy and proxy→upstream), including IDs, timings, models, provider, status, and error classification.
- [x] 1.2 Implement a bounded in-memory store plus Server-Sent Events (or WS) stream to publish live events and an HTTP snapshot endpoint for initial UI load.
- [x] 1.3 Gate capture behind `proxy --ui` (or an env flag) to avoid overhead when UI is off; include redaction/truncation of bodies and headers.

## 2. CLI and server wiring
- [x] 2.1 Extend `xling proxy` with `--ui` (same host/port as proxy) to serve the UI and APIs from the proxy server; reuse access-key auth for UI endpoints.
- [x] 2.2 Add proxy UI bootstrap (static asset serving + API routes) on the existing proxy listener; ensure CORS/host binding remain local by default.

## 3. UI experience
- [x] 3.1 Build Network table view (DevTools-inspired) showing method, path, status, duration, size, model, provider, and stream indicator with filters (status class, provider, text search).
- [x] 3.2 Add request detail panel with tabs for Overview, Request, Response, Timeline; show correlated upstream call vs client request, body previews, headers, and retry/key-rotation notes.
- [x] 3.3 Implement AI assist panel that sends selected request/response metadata to the model router and renders summaries/explanations without leaking secrets.
- [x] 3.4 Add “Export HAR/JSON” for selected or filtered requests, using redacted/truncated payloads and current buffer contents.

## 4. Quality and docs
- [x] 4.1 Add tests for event capture, correlation, redaction, and SSE snapshot endpoints.
- [x] 4.2 Add UI tests (component/unit) for table filtering and detail rendering; smoke-test AI assist flow with mocked backend.
- [x] 4.3 Update CLI help and README/proxy docs to mention `--ui`, security expectations, and limits.
