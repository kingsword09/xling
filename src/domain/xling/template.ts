/**
 * Default Xling configuration template
 */

import type { ProxyConfig, XlingConfig } from "./config.ts";

/**
 * Default configuration for Xling
 *
 * This template is used when no configuration file exists.
 * Users should replace the empty apiKey with their actual key.
 *
 * Unified configuration:
 * - providers: Global provider list (used by p, discuss, council commands)
 * - defaultModel: Default model for all services
 * - proxy: Proxy-specific settings
 *   - providers: Optional override for proxy (when set, proxy uses only these)
 *   - port, accessKey, loadBalance, modelMapping, keyRotation
 * - retryPolicy: Retry settings for prompt service
 * - shortcuts: Command shortcuts
 */
export const DEFAULT_XLING_CONFIG: XlingConfig = {
  providers: [
    {
      name: "openai-default",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "", // User must configure this
      models: [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
      ],
      priority: 1,
      timeout: 60000,
    },
  ],
  defaultModel: "gpt-4o-mini",
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 1000,
  },
  shortcuts: {
    lc: {
      command: "x",
      args: ["-t", "claude", "-c"],
      description: "Launch Claude and continue last conversation",
    },
    lx: {
      command: "x",
      args: ["-t", "codex"],
      description: "Launch Codex",
    },
    gdp: {
      shell: "git diff | xling p --stdin 'Summarize these changes'",
      description: "Git diff with AI summary",
    },
  },
};

/**
 * Default proxy configuration template
 * Note: By default, proxy uses global providers from XlingConfig.
 * Set proxy.providers to override with a dedicated provider list.
 */
export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  // providers: [], // Uncomment and add providers to override global providers for proxy only
  enabled: true,
  // accessKey: "your-secret-access-key", // Uncomment to enable access protection
  loadBalance: "failover",
  keyRotation: {
    enabled: true,
    onError: true,
    cooldownMs: 60000,
  },
};

/**
 * Example proxy configuration with dedicated providers
 * When proxy.providers is set, proxy uses only these providers,
 * while other commands (p, discuss, council) continue using global providers.
 */
export const EXAMPLE_PROXY_CONFIG: ProxyConfig = {
  providers: [
    {
      name: "proxy-openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-proxy-specific-key",
      models: ["gpt-4o", "gpt-4o-mini"],
      priority: 1,
    },
  ],
  enabled: true,
  accessKey: "your-secret-access-key",
  loadBalance: "failover",
  keyRotation: {
    enabled: true,
    onError: true,
    cooldownMs: 60000,
  },
};

/**
 * Example configuration with multiple providers
 * This serves as documentation for users
 *
 * Configuration structure:
 * - providers: Global provider list used by p, discuss, council commands
 *   - Use apiKey for single key, apiKeys for multiple keys (rotation)
 * - defaultModel: Default model for all services
 * - proxy: Proxy-specific settings
 *   - providers: Optional override (when set, proxy uses only these providers)
 *   - modelMapping, loadBalance, keyRotation, etc.
 * - retryPolicy: Retry settings for prompt service
 */
export const EXAMPLE_MULTI_PROVIDER_CONFIG: XlingConfig = {
  providers: [
    {
      name: "openai-primary",
      baseUrl: "https://api.openai.com/v1",
      apiKeys: ["sk-proj-key1", "sk-proj-key2", "sk-proj-key3"], // Multiple keys for rotation
      models: ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"],
      priority: 1,
      timeout: 60000,
      weight: 3,
    },
    {
      name: "openai-backup",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-proj-backup-key", // Single key
      models: ["gpt-4", "gpt-3.5-turbo"],
      priority: 2,
      timeout: 30000,
      weight: 1,
    },
    {
      name: "azure-openai",
      baseUrl: "https://your-resource.openai.azure.com/openai/deployments",
      apiKey: "azure-api-key",
      models: ["gpt-4"],
      priority: 3,
      timeout: 45000,
      headers: {
        "api-version": "2024-02-15-preview",
      },
    },
    {
      name: "custom-provider",
      baseUrl: "https://custom-ai.example.com/v1",
      apiKey: "custom-key",
      models: ["llama-3-70b", "mixtral-8x7b"],
      priority: 10,
    },
  ],
  defaultModel: "gpt-4o",
  proxy: {
    // Uncomment to use dedicated providers for proxy only:
    // providers: [
    //   {
    //     name: "proxy-azure",
    //     baseUrl: "https://your-resource.openai.azure.com/openai/deployments",
    //     apiKey: "azure-proxy-key",
    //     models: ["gpt-4"],
    //   },
    // ],
    enabled: true,
    port: 4320,
    // accessKey: "your-secret-access-key", // Uncomment to enable access protection
    loadBalance: "failover",
    // Map Claude model names to actual models (proxy only)
    modelMapping: {
      "claude-*": "gpt-4o", // All claude models -> gpt-4o
      "*": "gpt-4o-mini", // Fallback for unknown models
    },
    keyRotation: {
      enabled: true,
      onError: true,
      cooldownMs: 60000,
    },
  },
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
  shortcuts: {
    lc: {
      command: "x",
      args: ["-t", "claude", "-c"],
      description: "Launch Claude and continue",
    },
    lx: {
      command: "x",
      args: ["-t", "codex"],
      description: "Launch Codex",
    },
    gs: {
      command: "settings:list",
      args: ["--tool", "claude"],
      description: "List Claude settings",
    },
    gsx: {
      command: "settings:list",
      args: ["--tool", "codex"],
      description: "List Codex settings",
    },
    gdp: {
      shell: "git diff | xling p --stdin 'Summarize these changes'",
      description: "Git diff with AI summary",
    },
    gsp: {
      shell: "git status --short | xling p --stdin 'Explain these changes'",
      description: "Git status with AI explanation",
    },
    gcm: {
      shell: {
        win32:
          "git add -N . && git diff HEAD | xling p --stdin 'Analyze changes and generate commit message in both Chinese and English'",
        default:
          "git diff HEAD; git ls-files --others --exclude-standard | while read file; do git diff --no-index /dev/null \"$file\" 2>/dev/null || true; done | xling p --stdin 'Analyze changes and generate commit message in both Chinese and English'",
      },
      description:
        "Generate commit message for all changes (platform-specific)",
    },
    pipe: {
      pipeline: [
        { command: "git", args: ["log", "--oneline", "-10"] },
        { command: "xling", args: ["p", "--stdin", "Summarize commits"] },
      ],
      description: "Recent commits with AI summary",
    },
  },
};
