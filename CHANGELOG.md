# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of `mcpvet`, a security scanner for MCP servers.
- Connector supporting **stdio** and **streamable HTTP** transports.
- 15 rules across 5 categories: tool poisoning, secrets leakage, dangerous
  capabilities, schema hygiene, and protocol conformance.
- `pretty`, `json`, and `sarif` (2.1.0) reporters.
- `.mcpvetrc.json` config, `--fail-on`, `--ignore`, `--transport`, `--timeout`,
  and `--list-rules` CLI options.
- Composite GitHub Action (`action.yml`) and programmatic API.
- Live end-to-end tests over both transports plus a vulnerable/clean fixture pair.
