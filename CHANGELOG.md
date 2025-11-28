# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.2] - 2025-11-28

### Changed
- Improved error handling in settings adapters
- Refactored adapters for better maintainability
- Enhanced codex inspect functionality

### Fixed
- Various bug fixes in settings management

## [0.9.1] - 2025-11-28

### Added
- `settings:sync` command for syncing Codex config
- Bidirectional sync with `--reverse` flag
- Interactive setup for Codex providers
- Auth profile restore capability

### Changed
- Updated proxy and council command documentation

## [0.9.0] - 2025-11-27

### Added
- `proxy` command: OpenAI-compatible API gateway with load balancing and key rotation
- `council` command: Multi-model evaluation and synthesis
- Auth profile management for Codex
- Enhanced Responses API handling

### Changed
- Upgraded Web UI to React 19

### Removed
- Deprecated `llms` command

## [0.8.3] - 2025-11-26

### Added
- Interactive profile selection for `switch` command

### Changed
- Upgraded TailwindCSS and integrated with Vite plugin
- Improved CI workflow security for commit messages

## [0.8.2] - 2025-11-25

### Added
- Clickable mentions for chat navigation
- Single and bulk session export functionality

### Changed
- Enabled promise linting and updated dependencies

## [0.8.1] - 2025-11-24

### Added
- Multi-model discuss and prompt router (`p` command)

### Changed
- Lazily load Markdown renderer to improve performance
