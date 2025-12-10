import { describe, expect, it } from "vitest";
import {
  ProxyEventStore,
  makeBodyPreview,
  sanitizeHeaders,
} from "@/services/proxy/recorder.ts";

describe("ProxyEventStore", () => {
  it("stores and truncates bodies", () => {
    const store = new ProxyEventStore({ maxBodyBytes: 10 });
    const record = store.startRecord({
      id: "req1",
      method: "POST",
      path: "/v1/chat",
      body: { foo: "123456789012345" },
    });
    expect(record.request.truncated).toBe(true);
    const snapshot = store.getSnapshot();
    expect(snapshot).toHaveLength(1);
  });

  it("redacts auth headers", () => {
    const headers = sanitizeHeaders({
      Authorization: "secret",
      "X-API-Key": "secret2",
      Accept: "json",
    });
    expect(headers?.Authorization).toBe("[redacted]");
    expect(headers?.["X-API-Key"]).toBe("[redacted]");
    expect(headers?.Accept).toBe("json");
  });

  it("evicts older records when over capacity", () => {
    const store = new ProxyEventStore({ maxRecords: 2, captureBodies: false });
    store.startRecord({ id: "a", method: "GET", path: "/a" });
    store.startRecord({ id: "b", method: "GET", path: "/b" });
    store.startRecord({ id: "c", method: "GET", path: "/c" });
    const ids = store.getSnapshot().map((r) => r.id);
    expect(ids).toEqual(["b", "c"]);
  });
});

describe("makeBodyPreview", () => {
  it("handles strings and truncation", () => {
    const preview = makeBodyPreview("1234567890", 5, true);
    expect(preview.bodyPreview).toBe("12345");
    expect(preview.truncated).toBe(true);
  });
});
