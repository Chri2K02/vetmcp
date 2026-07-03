# Rules

Every finding carries a `ruleId`, a `severity`, the `location` in the server
surface, and a `remediation`. Severity drives the exit code via `--fail-on`
(default `medium`). Anchor links below match the SARIF `helpUri`s.

Severity legend: **critical** and **high** are security issues you should fix
before shipping; **medium** is a security-relevant weakness worth constraining;
**low** is hygiene advice; **info** is diagnostic.

---

## Tool poisoning

Instructions or hidden content smuggled into metadata that a model reads as part
of its context.

### <a id="poisoninginjection-phrase"></a>`poisoning/injection-phrase` — critical

Tool, resource, or prompt metadata contains phrases that instruct the model
rather than describe functionality: instruction overrides ("ignore all previous
instructions"), concealment ("do not tell the user"), role/system tags, or
exfiltration directions ("send the conversation to …").

**Fix:** metadata should only describe what a tool does. A legitimate
description never needs to override instructions or hide anything from the user.

### <a id="poisoningcross-tool-influence"></a>`poisoning/cross-tool-influence` — high

Metadata tries to change how or when the model uses *other* tools ("before using
any other tool…", "use this instead of the X tool"). A common vector for
rug-pull attacks where a benign server turns malicious after install.

**Fix:** a tool description must not dictate orchestration. Remove cross-tool
directives.

### <a id="poisoninginvisible-unicode"></a>`poisoning/invisible-unicode` — critical

Metadata contains zero-width characters, bidirectional control characters, or
Unicode **tag** characters (U+E0000–U+E007F). These are invisible to a human
reviewer but fully readable by the model — a known hidden-instruction channel.
Resource *contents* are exempt (legitimate text can contain anything); only
metadata surfaces are checked.

**Fix:** strip invisible characters from all metadata.

---

## Secrets leakage

### <a id="secretsknown-pattern"></a>`secrets/known-pattern` — critical

A string matching a well-known credential format appears in advertised text:
AWS access keys, GitHub/Slack/Anthropic/OpenAI/Google API keys, JWTs, private
key blocks, or connection strings with embedded credentials. Evidence is
redacted in output.

**Fix:** rotate the credential and remove it from metadata/resources. Load
secrets from the environment at call time.

### <a id="secretsassignment"></a>`secrets/assignment` — high

A `key`/`token`/`secret`/`password` assignment with a long, high-entropy value.
An entropy gate keeps placeholders like `your-api-key-here` from firing.

**Fix:** reference secrets by environment variable name, not value.

---

## Dangerous capabilities

Not vulnerabilities on their own — high-blast-radius capabilities that need
explicit constraints and review.

### <a id="capabilityexec-surface"></a>`capability/exec-surface` — high

A tool appears to execute shell commands, scripts, or arbitrary code. Combined
with model-controlled input, that is remote code execution by design.

**Fix:** allowlist commands, sandbox execution, require human approval
(`annotations.destructiveHint`), and document the blast radius.

### <a id="capabilityunconstrained-path"></a>`capability/unconstrained-path` — medium

A tool that writes or deletes files accepts a path parameter with no constraint
(no `pattern`, `enum`, or `format`), letting the model target any location the
process can reach.

**Fix:** constrain the parameter to an allowed root and validate resolved paths
server-side.

### <a id="capabilityurl-fetch"></a>`capability/url-fetch` — medium

A tool that fetches URLs accepts an unconstrained URL parameter — a server-side
request forgery primitive from inside a private network (cloud metadata
endpoints, internal services).

**Fix:** restrict to an allowlist of hosts and block private/link-local ranges
server-side before fetching.

---

## Schema hygiene

### <a id="schemamissing-input-schema"></a>`schema/missing-input-schema` — medium

A tool advertises no input schema, so clients cannot validate arguments. An
explicit empty-object schema (a tool that takes no arguments) is fine.

### <a id="schemamissing-description"></a>`schema/missing-description` — low

A tool has no description. Models pick tools by description; an undocumented tool
invites misrouting.

### <a id="schemaadditional-properties"></a>`schema/additional-properties` — low

An object schema does not set `additionalProperties: false`, so undeclared
arguments pass client validation. Note: the official MCP SDK does not set this by
default, so most SDK-built servers trip this rule — it's low severity for that
reason.

### <a id="schemauntyped-parameter"></a>`schema/untyped-parameter` — low

A declared parameter has no `type` (or `enum`/`const`/`anyOf`), so any value
passes validation.

---

## Protocol conformance

### <a id="conformancelist-failure"></a>`conformance/list-failure` — medium

The server advertises a capability (tools/resources/prompts) during
initialization, but the corresponding list request failed.

### <a id="conformanceduplicate-tool-name"></a>`conformance/duplicate-tool-name` — medium

Two or more tools share a name. Clients key tools by name; duplicates cause
nondeterministic routing.

### <a id="conformanceprobe-error"></a>`conformance/probe-error` — info

Non-fatal errors observed while capturing the snapshot (failed resource reads,
timeouts), surfaced for visibility.
