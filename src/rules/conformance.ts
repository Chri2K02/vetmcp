/**
 * Protocol conformance basics observed during the probe: capabilities that
 * do not work, duplicate tool names, probe-level errors.
 */
import type { Finding, Rule } from "../types.js";

export const capabilityListFailureRule: Rule = {
  meta: {
    id: "conformance/list-failure",
    name: "Advertised capability fails to list",
    description:
      "The server advertises a capability (tools/resources/prompts) but the corresponding list request failed.",
    defaultSeverity: "medium",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    const { advertisedCapabilities, listResults } = snapshot.probe;
    const checks: Array<[keyof typeof advertisedCapabilities, string]> = [
      ["tools", "tools/list"],
      ["resources", "resources/list"],
      ["prompts", "prompts/list"],
    ];
    for (const [capability, method] of checks) {
      if (advertisedCapabilities[capability] && listResults[capability] === "error") {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Server advertises "${capability}" capability but ${method} failed.`,
          location: { kind: "server", name: snapshot.probe.serverInfo?.name ?? snapshot.target },
          remediation: `Either implement ${method} correctly or stop advertising the "${capability}" capability during initialization.`,
        });
      }
    }
    return findings;
  },
};

export const duplicateToolNameRule: Rule = {
  meta: {
    id: "conformance/duplicate-tool-name",
    name: "Duplicate tool names",
    description:
      "Two or more tools share the same name. Clients key tools by name; duplicates cause nondeterministic routing.",
    defaultSeverity: "medium",
  },
  check(snapshot): Finding[] {
    const seen = new Map<string, number>();
    for (const tool of snapshot.tools) {
      seen.set(tool.name, (seen.get(tool.name) ?? 0) + 1);
    }
    const findings: Finding[] = [];
    for (const [name, count] of seen) {
      if (count > 1) {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Tool name "${name}" is advertised ${count} times.`,
          location: { kind: "tool", name },
          remediation: "Give every tool a unique name.",
        });
      }
    }
    return findings;
  },
};

export const probeErrorRule: Rule = {
  meta: {
    id: "conformance/probe-error",
    name: "Errors observed while probing",
    description:
      "Non-fatal errors occurred while capturing the server snapshot (failed resource reads, timeouts). Reported for visibility.",
    defaultSeverity: "info",
  },
  check(snapshot): Finding[] {
    return snapshot.probe.errors.map((error) => ({
      ruleId: this.meta.id,
      severity: this.meta.defaultSeverity,
      message: error,
      location: {
        kind: "server",
        name: snapshot.probe.serverInfo?.name ?? snapshot.target,
      },
      remediation:
        "Investigate why the operation failed; a production server should serve every advertised capability reliably.",
    }));
  },
};

export const conformanceRules: Rule[] = [
  capabilityListFailureRule,
  duplicateToolNameRule,
  probeErrorRule,
];
