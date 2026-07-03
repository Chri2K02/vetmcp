# Contributing to mcpvet

The most valuable contribution is **a new rule**. The architecture is built so
that adding one is small and self-contained.

## Setup

```bash
npm install
npm test          # unit + live e2e against fixture servers
npm run typecheck
npm run lint
```

## Adding a rule

A rule is a pure function `(snapshot: ServerSnapshot) => Finding[]`. It never
does I/O — the connector has already captured everything the server exposes into
the snapshot. That makes rules trivial to test.

**1. Write the rule.** Add it to the relevant file in `src/rules/` (or create a
new category file). Example:

```ts
import type { Finding, Rule } from "../types.js";
import { collectTextSources, excerpt } from "./textSources.js";

export const myRule: Rule = {
  meta: {
    id: "poisoning/my-check",           // "category/short-name"
    name: "Human-readable name",
    description: "One sentence on what it catches.",
    defaultSeverity: "high",            // critical | high | medium | low | info
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const source of collectTextSources(snapshot)) {
      if (/* your condition on source.text */ false) {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `What was found in ${source.location.kind} "${source.location.name}".`,
          location: source.location,
          evidence: excerpt(source.text),
          remediation: "How to fix it.",
        });
      }
    }
    return findings;
  },
};
```

Helpers available:

- `collectTextSources(snapshot)` — every LLM-visible text surface (tool/param
  descriptions, resource metadata + previewed contents, prompt metadata) paired
  with its `location`. Use this for content-scanning rules.
- `excerpt(text, max?)` — trim an evidence string for display.
- For structural rules, read `snapshot.tools` / `snapshot.resources` /
  `snapshot.prompts` / `snapshot.probe` directly.

**2. Register it.** Add the rule to its category array, which is already
re-exported from `src/rules/index.ts`.

**3. Test it.** Add cases next to the rule (`*.test.ts`) using the snapshot
factory:

```ts
import { makeSnapshot, makeTool } from "../testing/snapshotFactory.js";

it("flags the bad thing", () => {
  const snapshot = makeSnapshot({ tools: [makeTool({ description: "bad" })] });
  expect(myRule.check(snapshot)).toHaveLength(1);
});
```

Always include a **negative case** proving the rule stays quiet on clean input —
false positives are the fastest way to make a scanner ignored.

**4. Document it.** Add an entry to `docs/rules.md` with an anchor matching the
rule id (`category/name` → `categoryname`), so the SARIF `helpUri` resolves.

## Guidelines

- **High signal over high recall.** A rule that fires on real problems and stays
  silent otherwise is worth ten noisy ones.
- **Pick severity honestly.** Reserve `critical`/`high` for genuine security
  issues. Hygiene belongs at `low`.
- **Never do I/O in a rule.** If you need new data from the server, extend the
  connector and the `ServerSnapshot` type instead.

Run `npm test && npm run lint && npm run typecheck` before opening a PR.
