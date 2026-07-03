# mcpvet

> `npm audit` for MCP servers. Point it at any Model Context Protocol server and it reports the security problems in its tools, resources, and prompts — tool poisoning, leaked secrets, dangerous capabilities, and more.

[![CI](https://github.com/mcpvet/mcpvet/actions/workflows/ci.yml/badge.svg)](https://github.com/mcpvet/mcpvet/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcpvet.svg)](https://www.npmjs.com/package/mcpvet)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

MCP servers ship tools straight into an LLM's context. A malicious or careless
server can hide instructions in a tool description, leak an API key in its
metadata, or expose a shell command to the model — and the official Inspector
won't tell you. `mcpvet` connects over the real MCP protocol, snapshots
everything the server advertises, and runs security rules against it.

```bash
npx mcpvet "node my-server.js"
```

```
mcpvet scanned my-server v1.2.0 (stdio, 6 tools, 2 resources, 0 prompts)

  CRITICAL poisoning/injection-phrase
           Instruction-override phrase found in tool "get_weather" (description).
           at tool get_weather › description
           evidence: Ignore all previous instructions
           fix: Metadata should only describe what the tool does. Remove
                instructions aimed at the model...

  CRITICAL secrets/known-pattern
           Possible AWS access key ID exposed in tool "call_api" (description).
           at tool call_api › description
           evidence: AKIA…MPLE (redacted)
           fix: Rotate this credential immediately and remove it from metadata...

  HIGH     capability/exec-surface
           Tool "run_command" exposes a command/code execution surface.
           at tool run_command
           fix: If execution is intentional, constrain it: allowlist commands...

3 findings (2 critical, 1 high) in 9ms
```

Exit code is non-zero when findings reach the fail threshold, so it drops
straight into CI.

## Install

```bash
# one-off
npx mcpvet <target>

# or install
npm install -g mcpvet
```

Requires Node 20+.

## Usage

The target is either a **stdio command** or an **http(s) URL**:

```bash
mcpvet "node dist/server.js"           # stdio (spawns the command)
mcpvet "python -m my_mcp_server"       # stdio
mcpvet https://my-host.example.com/mcp # streamable HTTP
```

### Options

| Flag | Description |
|---|---|
| `-t, --transport <stdio\|http>` | Force the transport instead of inferring it |
| `-r, --reporter <pretty\|json\|sarif>` | Output format (default `pretty`) |
| `--fail-on <severity>` | Minimum severity that fails the scan (default `medium`) |
| `--ignore <rules>` | Comma-separated rule IDs or `category/*` globs to skip |
| `--timeout <ms>` | Per-operation timeout (default `30000`) |
| `--list-rules` | Print all rules and exit |

### Config file

Drop a `.mcpvetrc.json` in your project root:

```json
{
  "failOn": "high",
  "ignoreRules": ["schema/additional-properties", "conformance/*"]
}
```

CLI flags merge on top of the file.

## What it checks

Five rule categories. Full details in [docs/rules.md](docs/rules.md).

| Category | Catches |
|---|---|
| **Tool poisoning** | Prompt-injection phrases, hidden instructions via invisible Unicode, cross-tool manipulation |
| **Secrets leakage** | API keys, tokens, private keys, and connection strings exposed in metadata or resources |
| **Dangerous capabilities** | Command execution, unconstrained filesystem writes, arbitrary URL fetch (SSRF surface) |
| **Schema hygiene** | Missing schemas/descriptions, permissive `additionalProperties`, untyped parameters |
| **Protocol conformance** | Advertised capabilities that fail, duplicate tool names, probe errors |

## CI / GitHub Actions

Fail the build on any medium-or-worse finding, and upload results to the
**Security** tab via SARIF:

```yaml
name: mcp-security
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build

      - name: Scan MCP server
        run: npx mcpvet "node dist/server.js" --reporter sarif > mcpvet.sarif
        continue-on-error: true

      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: mcpvet.sarif

      - name: Fail on findings
        run: npx mcpvet "node dist/server.js" --fail-on high
```

## Programmatic API

```ts
import { captureSnapshot, runRules, allRules, shouldFail } from "mcpvet";

const snapshot = await captureSnapshot("node server.js");
const result = runRules(snapshot, allRules);

for (const finding of result.findings) {
  console.log(finding.severity, finding.ruleId, finding.message);
}

process.exitCode = shouldFail(result, "high") ? 1 : 0;
```

## How it works

```
target ──▶ connector ──▶ ServerSnapshot ──▶ engine (rules) ──▶ reporter ──▶ exit code
```

The **connector** is the only component that touches the network or spawns a
process. It produces a normalized `ServerSnapshot`. Every **rule** is a pure
function `(snapshot) => Finding[]` — no I/O, trivially testable, and easy to
contribute. See [CONTRIBUTING.md](CONTRIBUTING.md) to add one.

## Roadmap

- More rules per category (community-driven)
- Diff mode: fail only on findings a server didn't have before (rug-pull detection)
- Hosted continuous scanning for teams

## License

MIT
