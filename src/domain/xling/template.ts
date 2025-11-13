/**
 * Default Xling configuration template
 */

import type { XlingConfig } from "./config.ts";

/**
 * Default configuration for Xling prompt command
 *
 * This template is used when no configuration file exists.
 * Users should replace the empty apiKey with their actual key.
 */
export const DEFAULT_XLING_CONFIG: XlingConfig = {
  prompt: {
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
 * Example configuration with multiple providers
 * This serves as documentation for users
 */
export const EXAMPLE_MULTI_PROVIDER_CONFIG: XlingConfig = {
  prompt: {
    providers: [
      {
        name: "openai-primary",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-proj-xxx",
        models: ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"],
        priority: 1,
        timeout: 60000,
      },
      {
        name: "openai-backup",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-proj-yyy",
        models: ["gpt-4", "gpt-3.5-turbo"],
        priority: 2,
        timeout: 30000,
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
    defaultModel: "gpt-4",
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000,
    },
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
    pipe: {
      pipeline: [
        { command: "git", args: ["log", "--oneline", "-10"] },
        { command: "xling", args: ["p", "--stdin", "Summarize commits"] },
      ],
      description: "Recent commits with AI summary",
    },
  },
};
