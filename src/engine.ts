/**
 * Runs rules over a snapshot and aggregates findings. Knows nothing about
 * transports or output formats.
 */
import type {
  Finding,
  Rule,
  ScanConfig,
  ScanResult,
  ServerSnapshot,
  Severity,
} from "./types.js";
import { SEVERITY_ORDER } from "./types.js";

export const DEFAULT_CONFIG: ScanConfig = {
  ignoreRules: [],
  // Security findings (medium+) fail the scan; low-severity hygiene advice is
  // reported but does not break CI by default.
  failOn: "medium",
};

/** "poisoning/*" matches every rule in the category; exact IDs match one. */
export function isRuleIgnored(ruleId: string, ignoreRules: string[]): boolean {
  return ignoreRules.some((pattern) => {
    if (pattern === ruleId) return true;
    if (pattern.endsWith("/*")) {
      return ruleId.startsWith(pattern.slice(0, -1));
    }
    return false;
  });
}

export function runRules(
  snapshot: ServerSnapshot,
  rules: Rule[],
  config: ScanConfig = DEFAULT_CONFIG,
): ScanResult {
  const startedAt = new Date().toISOString();
  const start = performance.now();

  const findings: Finding[] = [];
  const ruleErrors: Array<{ ruleId: string; error: string }> = [];

  for (const rule of rules) {
    if (isRuleIgnored(rule.meta.id, config.ignoreRules)) continue;
    try {
      findings.push(...rule.check(snapshot));
    } catch (error) {
      // A broken rule must never kill the scan.
      ruleErrors.push({
        ruleId: rule.meta.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
      a.ruleId.localeCompare(b.ruleId),
  );

  return {
    snapshot,
    findings,
    ruleErrors,
    startedAt,
    durationMs: Math.round(performance.now() - start),
  };
}

/** True when any finding is at or above the configured threshold. */
export function shouldFail(result: ScanResult, failOn: Severity): boolean {
  return result.findings.some(
    (f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[failOn],
  );
}
