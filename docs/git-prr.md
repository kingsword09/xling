# `git:prr` – Checkout Pull Request

Checkout a pull request branch using GitHub CLI when available, or fall back to
`git fetch`/`git switch` when `gh` is missing or explicitly disabled.

## Usage

```bash
xling git:prr <pr-number> [FLAGS]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-b, --branch <name>` | Destination branch name (defaults to `pr/<id>`). |
| `-r, --remote <name>` | Remote to fetch from (default `origin`). |
| `--no-gh` | Skip GitHub CLI and use the git fallback directly. |

## Examples

```bash
# Checkout PR 123 (prefer gh, fallback to git)
xling git:prr 123

# Checkout PR 456 into a custom branch
xling git:prr 456 --branch feature/pr-456

# Force git strategy with a different remote
xling git:prr 789 --no-gh --remote upstream
```

## Notes

- When `gh` is available, the command effectively runs `gh pr checkout <id>`.
- The git fallback fetches `pull/<id>/head:<branch>` and then switches to the
  created branch, matching the branch name you provided (or `pr/<id>`).
