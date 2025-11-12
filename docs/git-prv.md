# `git:prv` – View Pull Request

Open a pull request in your preferred browser using GitHub CLI. Handy when you
know the PR number and want to jump straight to the review UI.

## Usage

```bash
xling git:prv <pr-number> [--browser <name>]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-b, --browser <name>` | Browser to launch (`chrome`, `safari`, `firefox`, `arc`, `edge`, `dia`). Default: `chrome`. |

## Examples

```bash
# Open PR 123 in Chrome
xling git:prv 123

# Open PR 456 in Safari
xling git:prv 456 --browser safari

# Open PR 789 in Firefox
xling git:prv 789 --browser firefox
```

## Notes

- Requires GitHub CLI (`gh`). Ensure `gh auth status` passes before using it.
- Browser names map to platform-specific commands (e.g., Safari is macOS only).
