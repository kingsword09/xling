# `git:wtl` – List Worktrees

Show all registered worktrees in a friendly, human-readable format. Each entry
displays the path and the branch (or `detached` when applicable).

## Usage

```bash
xling git:wtl
```

## Examples

```bash
xling git:wtl
```

Sample output:

```
✓ Available worktrees:

  [1] /Users/me/xling
      Branch: main

  [2] /Users/me/xling-feature-login
      Branch: feature/login
```

## Notes

- `git:wtl` wraps `git worktree list` and always prints a human-friendly summary.
- Use it before `git:wtr` or `git:wts` to confirm the exact path or branch name
  you want to operate on.
