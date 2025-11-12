# `git:wtr` – Remove Worktree

Remove a worktree by branch name, directory name, or absolute path. The command
guards against accidental deletions and can be forced when needed.

## Usage

```bash
xling git:wtr [--branch <name> | --path <path>] [--force]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-b, --branch <name>` | Branch name or worktree directory name to remove. |
| `-p, --path <path>` | Explicit worktree path to remove. |
| `-f, --force` | Force removal even if git reports issues. |

At least one of `--branch` or `--path` is required.

## Examples

```bash
# Remove by branch name
xling git:wtr -b main

# Remove by directory name
xling git:wtr -b xling-feature-login

# Remove by full path
xling git:wtr -p ../repo-feature

# Force removal
xling git:wtr -b experiment --force
```

## Notes

- Name matching is smart: `-b feature/login` will also match a directory named
  `repo-feature-login`.
- Use `git:wtl` beforehand to double-check the worktree path.
