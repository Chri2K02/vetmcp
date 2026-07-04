# vetmcp — Security Scanner for MCP Servers

**Date:** 2026-07-03
**Status:** Approved

## Summary

`vetmcp` is an open-source CLI that scans Model Context Protocol (MCP) servers for
security risks — the way `npm audit` scans dependencies. It connects to a target
server over the real MCP protocol, captures a snapshot of its advertised surface
(tools, resources, prompts, schemas), runs a set of security rules against that
snapshot, and reports findings with severities and remediation guidance. A non-zero
exit code on findings makes it a drop-in CI quality gate.

Usage: `npx vetmcp <target>` where target is a stdio command or an HTTP URL.

## Goals

1. **Resume-grade engineering artifact**: clean architecture, full test suite, CI,
   SARIF integration with GitHub code scanning, contributor-friendly rule system.
2. **Real utility**: catch genuine MCP security problems (tool poisoning, secrets
   leakage, dangerous capabilities) that the official Inspector does not check.
3. **Monetization path (later)**: open-core — free CLI, future paid hosted
   continuous scanning/monitoring for teams. Out of scope for v1.

## Non-goals (v1)

- No web dashboard, hosted service, or auth.
- No fuzzing, load testing, or active exploitation.
- No auto-fix.
- No fully deep rule categories — each category ships with a few high-signal
  checks; depth grows over time via contributions.

## Positioning

The official `@modelcontextprotocol/inspector` is a manual debugging GUI. Existing
test runners (mcp-server-tester etc.) focus on functional testing and are immature.
No polished tool owns "is this MCP server safe to ship?". vetmcp owns that.

## Rule Set (v1)

Each finding: `{ ruleId, severity (critical|high|medium|low|info), message,
location (tool/resource/prompt name + field), remediation }`.

| Category | Rule IDs | What it checks |
|---|---|---|
| Tool poisoning / prompt injection | `poisoning/*` | Imperative injection phrases in tool/param descriptions ("ignore previous instructions", "do not tell the user"), hidden text via invisible Unicode (zero-width chars, bidi overrides, tags block), suspicious cross-tool references ("before using any other tool...") |
| Secrets leakage | `secrets/*` | API keys, tokens, private keys, connection strings in tool descriptions, resource contents, prompt templates (pattern + entropy heuristics) |
| Dangerous capability surface | `capability/*` | Tools exposing shell/exec/eval semantics, unconstrained filesystem paths, arbitrary URL fetch (SSRF surface), unbounded string params on dangerous tools |
| Schema hygiene | `schema/*` | Missing input schema, missing descriptions, `additionalProperties` not disabled on object schemas, params with no type |
| Protocol conformance | `conformance/*` | Server initializes and responds to list requests, advertised capabilities match observable behavior, duplicate tool names |

## Architecture

```
src/
  connector/   — connects to target (stdio | streamable HTTP) via official
                 @modelcontextprotocol/sdk client; produces ServerSnapshot
  types.ts     — ServerSnapshot, Finding, Rule, Severity (shared contracts)
  rules/       — one module per rule; Rule = { id, meta, check(snapshot): Finding[] }
                 Pure functions. No I/O. Registered in rules/index.ts.
  engine.ts    — runs rules over snapshot, applies config (ignores, severity
                 threshold), aggregates ScanResult
  reporters/   — pretty (terminal, default) | json | sarif (2.1.0)
  cli.ts       — arg parsing, config loading (.vetmcprc.json), exit codes
fixtures/
  vulnerable-server/  — intentionally insecure MCP server (e2e test target)
  clean-server/       — well-behaved MCP server (no-findings baseline)
```

**Boundaries:** rules never do I/O; the connector never interprets findings; the
engine knows nothing about output formats. Each unit is independently unit-tested.

## Data flow

CLI parses args → connector connects and builds `ServerSnapshot` → engine runs all
registered rules → `ScanResult` → chosen reporter renders → CLI maps result to exit
code (`0` clean, `1` findings at/above `--fail-on` threshold, `2` scan error).

## Error handling

- Target unreachable / handshake failure → clear error + exit 2 (distinct from
  "findings found").
- A rule that throws is caught by the engine, reported as an internal-error
  finding (`info`), and never kills the scan.
- Connector applies a timeout (default 30 s) to hangs.

## Testing

- **Unit:** every rule tested against crafted snapshot fixtures (vitest).
- **Reporter:** snapshot tests for pretty/json; SARIF validated against schema shape.
- **E2E:** spawn `fixtures/vulnerable-server` over stdio, assert expected rule IDs
  fire; spawn `fixtures/clean-server`, assert zero findings and exit 0.
- CI (GitHub Actions): typecheck, lint, test, build on push/PR.

## Stack

TypeScript / Node ≥ 20, `@modelcontextprotocol/sdk`, commander (CLI), picocolors
(terminal output), vitest, tsup, published to npm as `vetmcp` (verified available).

## Launch checklist (post-v1)

README with demo GIF/output, CONTRIBUTING.md geared to adding rules, GitHub Action
usage snippet, Show HN / r/mcp post. Paid tier explorations only after traction.
