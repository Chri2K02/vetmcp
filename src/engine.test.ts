import { describe, expect, it } from "vitest";
import { isRuleIgnored, runRules, shouldFail } from "./engine.js";
import { makeSnapshot, makeTool } from "./testing/snapshotFactory.js";
import type { Rule } from "./types.js";

const noisyRule: Rule = {
  meta: {
    id: "test/noisy",
    name: "Noisy",
    description: "Always finds something.",
    defaultSeverity: "high",
  },
  check: (snapshot) => [
    {
      ruleId: "test/noisy",
      severity: "high",
      message: "noise",
      location: { kind: "server", name: snapshot.target },
      remediation: "n/a",
    },
  ],
};

const lowRule: Rule = {
  meta: {
    id: "test/low",
    name: "Low",
    description: "Low severity.",
    defaultSeverity: "low",
  },
  check: (snapshot) => [
    {
      ruleId: "test/low",
      severity: "low",
      message: "minor",
      location: { kind: "server", name: snapshot.target },
      remediation: "n/a",
    },
  ],
};

const throwingRule: Rule = {
  meta: {
    id: "test/broken",
    name: "Broken",
    description: "Always throws.",
    defaultSeverity: "info",
  },
  check: () => {
    throw new Error("rule exploded");
  },
};

describe("runRules", () => {
  it("aggregates findings sorted by severity", () => {
    const result = runRules(makeSnapshot({ tools: [makeTool()] }), [
      lowRule,
      noisyRule,
    ]);
    expect(result.findings.map((f) => f.ruleId)).toEqual([
      "test/noisy",
      "test/low",
    ]);
  });

  it("captures rule crashes without killing the scan", () => {
    const result = runRules(makeSnapshot(), [throwingRule, noisyRule]);
    expect(result.ruleErrors).toEqual([
      { ruleId: "test/broken", error: "rule exploded" },
    ]);
    expect(result.findings).toHaveLength(1);
  });

  it("skips ignored rules", () => {
    const result = runRules(makeSnapshot(), [noisyRule, lowRule], {
      ignoreRules: ["test/noisy"],
      failOn: "low",
    });
    expect(result.findings.map((f) => f.ruleId)).toEqual(["test/low"]);
  });
});

describe("isRuleIgnored", () => {
  it("matches exact ids and category globs", () => {
    expect(isRuleIgnored("poisoning/injection-phrase", ["poisoning/*"])).toBe(true);
    expect(isRuleIgnored("poisoning/injection-phrase", ["poisoning/injection-phrase"])).toBe(true);
    expect(isRuleIgnored("secrets/known-pattern", ["poisoning/*"])).toBe(false);
  });
});

describe("shouldFail", () => {
  it("respects the failOn threshold", () => {
    const result = runRules(makeSnapshot(), [lowRule]);
    expect(shouldFail(result, "low")).toBe(true);
    expect(shouldFail(result, "high")).toBe(false);
  });
});
