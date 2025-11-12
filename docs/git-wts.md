# `git:wts` – Switch to Worktree

Locate a matching worktree (by branch or directory name) and open a subshell in
that directory. Use `--path-only` for scripting when you just need the path for
`cd $(...)`.

## Usage

```bash
xling git:wts [--branch <name>] [--path-only]
```

## Flags

| Flag | Description |
| ---- | ----------- |
| `-b, --branch <name>` | Branch or worktree directory name to switch to. Defaults to `main`. |
| `--path-only` | Print the worktree path without launching a subshell. |

## Examples

```bash
# Start a subshell rooted at the main worktree
xling git:wts

# Switch to feature/login worktree (subshell)
xling git:wts -b feature/login

# Only print the path (useful for cd $(...))
cd $(xling git:wts --path-only -b bugfix/api)
```

## Notes

- The command resolves names in this order: exact branch match, exact directory
  match, then partial path match.
- On macOS/Linux it respects `$SHELL`; on Windows it falls back to `cmd.exe` or
  the `COMSPEC` environment variable.
