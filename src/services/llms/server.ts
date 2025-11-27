import LlmsServer from "@musistudio/llms";

import type { ProviderConfig } from "@/domain/xling/config.ts";
import { XlingAdapter } from "@/services/settings/adapters/xling.ts";

export type LlmsToolTarget = "claude" | "codex" | "gemini" | "all";

export const DEFAULT_LLMS_PORT = 4310;

type LlmsProviderConfig = {
  name: string;
  api_base_url: string;
  api_key: string;
  models: string[];
  transformer?: {
    use?: string[];
  };
};

export type LlmsGatewayOptions = {
  host?: string;
  port?: number;
  logger?: boolean;
};

export type LlmsGatewayContext = {
  baseUrl: string;
  modelAliases: string[];
  providers: LlmsProviderConfig[];
  warnings: string[];
  server: LlmsServer;
};

function mapProvider(
  provider: ProviderConfig,
  warnings: string[],
): LlmsProviderConfig | null {
  const apiKey = provider.apiKey ?? provider.apiKeys?.[0];

  if (!apiKey?.trim()) {
    warnings.push(`${provider.name}: skipping provider with no apiKey/apiKeys`);
    return null;
  }

  if (provider.headers && Object.keys(provider.headers).length > 0) {
    warnings.push(
      `${provider.name}: custom headers are not passed through the llms gateway`,
    );
  }

  if (provider.timeout) {
    warnings.push(
      `${provider.name}: timeout is managed by llms (per-request timeouts from xling are ignored)`,
    );
  }

  return {
    name: provider.name,
    api_base_url: provider.baseUrl,
    api_key: apiKey,
    models: provider.models,
  };
}

export async function startLlmsGateway(
  options: LlmsGatewayOptions = {},
): Promise<LlmsGatewayContext> {
  const adapter = new XlingAdapter();
  const config = adapter.readConfig(adapter.resolvePath("user"));

  const warnings: string[] = [];
  const mappedProviders = config.providers
    .map((provider: ProviderConfig) => mapProvider(provider, warnings))
    .filter((provider): provider is LlmsProviderConfig => Boolean(provider));

  if (!mappedProviders.length) {
    throw new Error(
      "No providers with API keys were found in ~/.claude/xling.json",
    );
  }

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? DEFAULT_LLMS_PORT;

  const server = new LlmsServer({
    initialConfig: {
      HOST: host,
      PORT: String(port),
      providers: mappedProviders,
    },
    logger: options.logger ?? true,
  });

  // Rewrite tool-friendly prefixes to the llms native endpoints
  const rewritePath = (url: string): string => {
    if (url === "/claude") return "/v1/messages";
    if (url.startsWith("/claude/")) return url.replace("/claude", "");

    if (url === "/codex") return "/v1/responses";
    if (url.startsWith("/codex/")) return url.replace("/codex", "");

    if (url === "/gemini") return "/health";
    if (url.startsWith("/gemini/")) return url.replace("/gemini", "");

    return url;
  };

  (server as any).addHook("onRequest", (req: any, _reply: any, done: any) => {
    const rawUrl = req.raw?.url;
    if (typeof rawUrl === "string") {
      req.raw.url = rewritePath(rawUrl);
    }
    done();
  });

  await server.start();

  const baseUrl = `http://${host}:${port}`;
  const modelAliases = mappedProviders.flatMap((provider) =>
    provider.models.map((model) => `${provider.name},${model}`),
  );

  return {
    baseUrl,
    modelAliases,
    providers: mappedProviders,
    warnings,
    server,
  };
}
