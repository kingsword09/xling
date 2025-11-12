# `git:wtp` – Prune Worktrees

Run `git worktree prune` to remove stale administrative files left behind when a
worktree directory was deleted manually.

## Usage

```bash
xling git:wtp
```

## Examples

```bash
# Remove stale entries
xling git:wtp
```

You will see a confirmation message such as `✓ Pruned stale worktrees`. Any git
output is printed below the status line.

## Notes

- No flags are required or supported.
- This command is safe to run periodically to keep your repository tidy.
