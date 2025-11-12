export const CLAUDE_SETTINGS_TEMPLATE = {
  env: {
    ANTHROPIC_AUTH_TOKEN: "",
    ANTHROPIC_BASE_URL: "https://api.anthropic.com",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    ANTHROPIC_MODEL: "claude-sonnet-4-5-20250929",
    ANTHROPIC_SMALL_FAST_MODEL: "claude-haiku-4-5-20251001",
  },
  permissions: {
    allow: [] as string[],
    deny: [] as string[],
  },
  enabledPlugins: {
    "example-skills@anthropic-agent-skills": false,
  },
} satisfies Record<string, unknown>;
