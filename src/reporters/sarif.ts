/**
 * SARIF 2.1.0 output so findings surface in GitHub's Security tab via
 * code-scanning upload (github/codeql-action/upload-sarif).
 */
import type { Finding, Rule, ScanResult, Severity } from "../types.js";

const SARIF_LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "warning",
  info: "note",
};

// GitHub renders security-severity for code scanning alerts.
const SECURITY_SEVERITY: Record<Severity, string> = {
  critical: "9.5",
  high: "8.0",
  medium: "5.5",
  low: "3.0",
  info: "0.0",
};

function locationText(finding: Finding): string {
  const { kind, name, field } = finding.location;
  return field ? `${kind}:${name}:${field}` : `${kind}:${name}`;
}

export function renderSarif(result: ScanResult, rules: Rule[]): string {
  const usedRuleIds = new Set(result.findings.map((f) => f.ruleId));
  const sarifRules = rules
    .filter((rule) => usedRuleIds.has(rule.meta.id))
    .map((rule) => ({
      id: rule.meta.id,
      name: rule.meta.name,
      shortDescription: { text: rule.meta.name },
      fullDescription: { text: rule.meta.description },
      helpUri: `https://github.com/mcpvet/mcpvet/blob/main/docs/rules.md#${rule.meta.id.replace("/", "")}`,
      properties: {
        "security-severity": SECURITY_SEVERITY[rule.meta.defaultSeverity],
        tags: ["security", "mcp"],
      },
    }));

  const ruleIndex = new Map(sarifRules.map((rule, index) => [rule.id, index]));

  const results = result.findings.map((finding) => ({
    ruleId: finding.ruleId,
    ruleIndex: ruleIndex.get(finding.ruleId),
    level: SARIF_LEVEL[finding.severity],
    message: {
      text: `${finding.message} Remediation: ${finding.remediation}`,
    },
    locations: [
      {
        logicalLocations: [
          {
            fullyQualifiedName: locationText(finding),
            kind: "member",
          },
        ],
        physicalLocation: {
          // SARIF requires a physical location for GitHub display; the MCP
          // surface has no file, so we anchor findings to the scan target.
          artifactLocation: { uri: "mcp-server" },
          region: { startLine: 1, startColumn: 1 },
        },
      },
    ],
  }));

  const log = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "mcpvet",
            informationUri: "https://github.com/mcpvet/mcpvet",
            version: "0.1.0",
            rules: sarifRules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(log, null, 2);
}
