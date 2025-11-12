# `git:prc` – Create Pull Request

Create a GitHub pull request using the GitHub CLI (`gh`) with optional browser
preview, reviewers, labels, and draft support.

## Usage

```bash
xling git:prc [FLAGS]
```

## Key Flags

| Flag | Description |
| ---- | ----------- |
| `-t, --title <text>` | PR title. |
| `-b, --body <text>` | PR description/body. |
| `--base <branch>` | Base branch (defaults to repo default). |
| `--head <branch>` | Head branch (defaults to current branch). |
| `-d, --draft` | Create the PR as a draft. |
| `-w, --web` | Open the PR in a browser after creation. |
| `--browser <name>` | Browser to use with `--web` (`chrome`, `safari`, `firefox`, `arc`, `edge`, `dia`). Default: `chrome`. |
| `-a, --assignee <user>` | Assign user(s). Repeat the flag for multiple assignees. |
| `-r, --reviewer <user>` | Request reviewer(s). Repeat as needed. |
| `-l, --label <label>` | Apply label(s). Repeat as needed. |

## Examples

```bash
# Interactive flow (prompts for title/body)
xling git:prc

# Provide title and body inline
xling git:prc --title "Feature X" --body "Implements feature X"

# Create a draft PR
xling git:prc --draft --title "WIP: Feature X"

# Open in Safari after creation
xling git:prc --web --browser safari

# Add reviewers, assignees, and labels
xling git:prc --reviewer user1 --reviewer user2 \
              --assignee maintainer \
              --label bug --label urgent
```

## Notes

- The command shells out to `gh pr create` under the hood; make sure you are
  authenticated with GitHub CLI.
- `--web` respects the `--browser` flag so you can preview in Safari, Firefox,
  Arc, Edge, or Dia in addition to Chrome.
