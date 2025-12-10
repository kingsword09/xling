## ADDED Requirements

### Requirement: Proxy UI Launch Mode
The system SHALL provide a `--ui` flag for `xling proxy` that starts the proxy and serves the web UI/APIs from the same host/port as the proxy (default localhost:4320 or the user-supplied `--host/--port`), reusing the proxy access key for authentication.

#### Scenario: Start proxy with UI
- **WHEN** the user runs `xling proxy --ui --port 5555`
- **THEN** the proxy handles API traffic and the browser UI is available on the same host/port (e.g., http://127.0.0.1:5555), protected by the same access key when set.

### Requirement: Request Capture and Correlation
The proxy SHALL capture structured events for each client request and its upstream call(s), including requestId, method, path, status, duration, model, provider, streaming flag, retry count, and error classification; bodies are stored as redacted previews (size-limited). Events MUST be exposed via an in-memory ring buffer snapshot endpoint and a live SSE stream, both gated to UI mode.

#### Scenario: Capture inbound and upstream legs
- **WHEN** a client request hits the proxy and the proxy forwards it upstream
- **THEN** the buffer contains one record with correlated client and upstream legs (shared id), redacted auth headers, and marked if body was truncated, accessible via both snapshot and SSE endpoints.

### Requirement: Network Console UI
The UI SHALL present a DevTools-style network table that auto-updates from the event stream, showing method, path, status, duration, size, model, provider, and stream indicator, with filters (status class, provider, text search) and sortable columns. Selecting a row opens a detail panel with tabs for Overview, Request, Response, and Timeline, showing both client-facing and upstream legs.

#### Scenario: Inspect a proxied request
- **WHEN** the proxy handles traffic while the UI is open
- **THEN** new rows appear in the table; the user can filter by provider, select a row, and view request/response bodies (flagged if truncated), headers, and hop-by-hop timing in the detail panel.

### Requirement: AI-Assisted Explanation
The UI SHALL let the user ask for an explanation of a selected request/response using the configured model router; the backend MUST strip secrets before sending context to the model and stream back a summary/explanation to the UI.

#### Scenario: Explain an error response
- **WHEN** a request ends with a 401 and the user clicks “Explain” (or adds a custom prompt)
- **THEN** the system sends the stored metadata and redacted previews to the model router and returns a streamed explanation that identifies likely causes and remediation steps without exposing secrets.

### Requirement: HAR/JSON Export
The system SHALL allow exporting selected or filtered captured requests to a HAR or JSON bundle that preserves timings, headers, and body previews while redacting secrets and marking any truncation.

#### Scenario: Export filtered requests
- **WHEN** the user filters the Network table (e.g., provider=openai, status>=400) and clicks Export
- **THEN** the downloaded HAR/JSON contains only the currently filtered records with redacted Authorization-like headers, annotated truncation flags, and the same timing metadata as shown in the UI.

### Requirement: Safety and Performance Guardrails
Event capture MUST be disabled unless UI mode is active; the UI APIs shall bind to localhost by default, respect proxy access-key auth, keep data in memory only, and enforce configurable limits on buffer length and body preview size.

#### Scenario: Run proxy without UI
- **WHEN** the proxy starts without `--ui`
- **THEN** no capture endpoints are exposed, no additional memory buffer is allocated, and proxy throughput remains unchanged aside from existing logging.
