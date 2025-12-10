## Context
- Users want a DevTools-like view for `xling proxy` that shows both legs of each request (client→proxy and proxy→upstream) with timing, bodies, and retries/key-rotation effects. Reference inspiration: Chrome Network panel and bscript/rep MITM UI.
- Current proxy only logs to stdout; no structured events, no UI, and no AI guidance on failures.
- The proxy already assigns `requestId` and classifies errors; discuss UI/server patterns exist for Web UI bootstrapping.

## Goals / Non-Goals
- Goals: live, correlated request view; easy inspection of request/response payloads with safe redaction; AI-powered explanations using configured providers; minimal overhead when UI disabled.
- Non-goals: full packet capture/har; long-term persistence; multi-user auth; editing/resending requests (can follow-up later).

## Decisions
- **Capture hook**: Wrap `handleProxyRequest` to emit structured events at key phases (incoming request, upstream request, upstream response, final client response, error/retry). Reuse existing `requestId`; add `correlationId` shared across both legs.
- **Transport**: Use Server-Sent Events for live streaming (`/proxy/stream`) plus `/proxy/records` snapshot for initial page load. SSE keeps KISS and works with Bun easily.
- **Storage**: In-memory ring buffer (configurable, default 200 records). Each record stores metadata and body previews (stringified, truncated 8KB) plus flags `truncated`, `redacted`.
- **Redaction**: Strip Authorization/api keys headers; mask access key; optionally disable body capture via flag/config. Streaming bodies are preview-only (first N chunks) to avoid memory blow.
- **UI architecture**: Add a `proxy` view inside existing React app (route/tab). Network table + detail panel with tabs (Overview/Request/Response/Timeline). Use tailwind + existing design language, but focus on data density over ornamental gradients.
- **AI assist**: Backend endpoint `/proxy/analyze` accepts a request-id and user prompt, fetches the stored record, and calls `createRouter()` to run a summarization/explanation prompt using locally configured providers; redact secrets before sending. UI renders streaming text.
- **CLI UX**: `xling proxy --ui` serves the UI/APIs on the same host/port as the proxy (serving dist/ui). If UI flag set, proxy enables event capture; otherwise capture stays off.
- **HAR export**: Provide an endpoint/route to export selected or filtered records as redacted/truncated HAR (or JSON) using the buffer contents; exclude secrets and note truncation in entries.
- **Security**: Bind UI server to localhost by default; reuse proxy `accessKey` for UI API auth; CORS locked to same origin. No data written to disk.
- **Performance**: Event capture path avoids deep copies; body parsing only when content-type JSON and size within limit. Capture can be toggled per request (sampling knob) if overhead observed.

## Risks / Trade-offs
- SSE can drop events on slow clients; mitigation: snapshot endpoint + small reconnection window.
- Body truncation may hide critical info; UI should signal truncation and allow opt-in larger limit via env/flag.
- AI assist latency tied to upstream models; consider defaulting to a fast local/provider fallback in prompt router.

## Migration Plan
1) Land capture primitives + SSE/snapshot endpoints gated behind UI flag.
2) Add CLI flag and bootstrap UI server.
3) Ship Network UI + AI assist front-end consuming new endpoints.
4) Update docs and tests; keep feature behind flag until validated.

## Open Questions
- Do we need per-request sampling toggle exposed in CLI/config or keep internal?
