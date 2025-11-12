# `git:wta` – Add Worktree

Create a new git worktree with sensible defaults and protections. By default it
targets the `main` branch and auto-generates a path such as
`../repo-branch-name`.

## Usage

```bash
xling git:wta [FLAGS]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-b, --branch <name>` | Source branch (defaults to `main`). |
| `-p, --path <path>` | Custom path for the new worktree. Omitting it enables auto path generation. |
| `-f, --force` | Overwrite the destination path even if it exists. |
| `--detach` | Create a detached HEAD worktree (`git worktree add --detach`). |

## Examples

```bash
# Create a worktree for main (auto path)
xling git:wta

# Add worktree for feature/login (auto path)
xling git:wta -b feature/login

# Create worktree at a custom location
xling git:wta -b docs -p ../xling-docs

# Detach head and force creation even if the directory exists
xling git:wta -b experiment --detach --force
```

## Notes

- The command refuses to reuse a branch that is already checked out by another
  worktree unless you pass `--force`.
- Auto-generated paths follow the pattern `../<repo-name>-<branch-name>` with
  `/` characters replaced by `-`.
