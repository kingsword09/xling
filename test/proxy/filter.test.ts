import { describe, expect, it } from "vitest";
import { filterRecords } from "@/ui/proxy/filter.ts";
import type { ProxyRecord } from "@/ui/proxy/types.ts";

const sample = (overrides: Partial<ProxyRecord>): ProxyRecord => ({
  id: "id",
  method: "GET",
  path: "/v1/chat",
  startedAt: Date.now(),
  request: {},
  ...overrides,
});

describe("filterRecords", () => {
  const records: ProxyRecord[] = [
    sample({
      id: "1",
      provider: "openai",
      status: 200,
      model: "gpt",
      path: "/v1/chat",
    }),
    sample({
      id: "2",
      provider: "anthropic",
      status: 500,
      model: "claude",
      path: "/v1/messages",
    }),
  ];

  it("filters by provider", () => {
    const res = filterRecords(records, {
      provider: "openai",
      statusClass: "",
      search: "",
      model: "",
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("1");
  });

  it("filters by status class", () => {
    const res = filterRecords(records, {
      provider: "",
      statusClass: "5xx",
      search: "",
      model: "",
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("2");
  });

  it("filters by search", () => {
    const res = filterRecords(records, {
      provider: "",
      statusClass: "",
      search: "claude",
      model: "",
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("2");
  });

  it("filters by model", () => {
    const res = filterRecords(records, {
      provider: "",
      statusClass: "",
      search: "",
      model: "gpt",
    });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("1");
  });
});
