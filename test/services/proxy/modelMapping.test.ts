import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "@/domain/xling/config.ts";
import { mapModel, selectProviderForModel } from "@/services/proxy/server.ts";
import { ProxyLoadBalancer } from "@/services/proxy/loadBalancer.ts";

const providers: ProviderConfig[] = [
  {
    name: "dnf",
    baseUrl: "https://api.example.com/v1",
    apiKey: "test-key",
    models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"],
  },
];

describe("model mapping", () => {
  it("applies prefix mapping even when provider lists a versioned variant", () => {
    const mapping = { "claude-haiku-*": "claude-haiku-4-5" };
    const result = mapModel(
      "claude-haiku-4-5-20251001",
      mapping,
      undefined,
      providers,
    );
    expect(result).toBe("claude-haiku-4-5");
  });

  it("keeps supported models when only wildcard mapping is provided", () => {
    const mapping = { "*": "fallback-model" };
    const result = mapModel("claude-sonnet-4-5", mapping, undefined, providers);
    expect(result).toBe("claude-sonnet-4-5");
  });
});

describe("provider selection", () => {
  it("matches shorter mapped model to a provider with versioned models", () => {
    const loadBalancer = new ProxyLoadBalancer("failover", 60_000);
    const provider = selectProviderForModel(
      providers,
      loadBalancer,
      "claude-opus-4-5",
    );
    expect(provider?.name).toBe("dnf");
  });
});
