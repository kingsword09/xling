# `proxy` – OpenAI-Compatible API Gateway

Start a local OpenAI-style API that fronts multiple upstream providers, adds
load balancing and API key rotation, and optionally protects access with a
shared key. The proxy reuses the same provider registry as `xling p`, so once
providers are configured you can plug the gateway into any OpenAI/Anthropic
client.

## Usage

```bash
xling proxy [FLAGS]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-p, --port <number>` | Port to bind (default: `4320`). |
| `--host <string>` | Host/interface (default: `127.0.0.1`). |
| `-k, --access-key <token>` | Optional bearer token required for all requests (overrides config). |
| `--[no-]logger` | Enable request logging (default: on). |

## Quick Start

1) Configure providers once in `~/.claude/xling.json`:

```json
{
  "providers": [
    {
      "name": "openai-primary",
      "baseUrl": "https://api.openai.com/v1",
      "apiKeys": ["sk-1", "sk-2"],
      "models": ["gpt-4o", "gpt-4.1-mini"],
      "weight": 3
    },
    {
      "name": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "sk-ant-xxx",
      "models": ["claude-3.5-sonnet", "claude-3.5-haiku"]
    }
  ],
  "defaultModel": "gpt-4o",
  "proxy": {
    "port": 4320,
    "host": "127.0.0.1",
    "accessKey": "dev-key",
    "loadBalance": "weighted",
    "modelMapping": { "gpt-4": "gpt-4o" },
    "passthroughResponsesAPI": ["gpt-4.1-codex"],
    "keyRotation": { "enabled": true, "onError": true, "cooldownMs": 60000 }
  }
}
```

2) Start the gateway:

```bash
xling proxy                  # localhost:4320
xling proxy -p 8080 -k demo  # custom port + access key
```

3) Point clients at the base URL printed on startup.

## Endpoints & Compatibility

- `/v1/chat/completions` — OpenAI Chat API
- `/v1/messages` — Anthropic Messages API
- `/v1/responses` — OpenAI Responses API (Codex)
- `/v1/completions` — OpenAI legacy Completions
- `/v1/models` or `/models` — advertise configured models (`provider,model`)
- `/health` — readiness probe
- `/stats` — load balancer statistics (per-provider/key health)

Requests prefixed with `/claude/` or `/openai/` are normalized to the same
paths, so client-specific base URLs also work.

## Load Balancing & Key Rotation

- Strategies: `failover` (default), `round-robin`, `random`, `weighted`
  (honors per-provider `weight`).
- Key rotation: supply `apiKeys` to rotate; failures mark a key on cooldown
  (default 60s, tunable via `proxy.keyRotation.cooldownMs`). When all keys for a
  provider fail it is temporarily marked unhealthy before retrying.
- Model aliases: use `proxy.modelMapping` to translate client-facing model
  names to provider-native ones.

## Client Examples

```bash
# Claude Code
ANTHROPIC_BASE_URL=http://127.0.0.1:4320 claude

# Codex (config.toml)
[model_providers.xling]
name = "xling"
base_url = "http://127.0.0.1:4320/v1"
wire_api = "responses"
experimental_bearer_token = "dev-key" # omit if no access key

# cURL (OpenAI chat)
curl http://127.0.0.1:4320/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-key" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'
```

## Monitoring & Troubleshooting

- `curl http://127.0.0.1:4320/health` — verify server and provider list.
- `curl http://127.0.0.1:4320/stats` — inspect per-provider request/error
  counts and key health.
- Run with `--no-logger` to silence request logs; re-enable for debugging.
