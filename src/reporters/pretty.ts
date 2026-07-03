/** Human-readable terminal report. */
import pc from "picocolors";
import type { Finding, ScanResult, Severity } from "../types.js";

const SEVERITY_STYLE: Record<Severity, (s: string) => string> = {
  critical: (s) => pc.bold(pc.red(s)),
  high: (s) => pc.red(s),
  medium: (s) => pc.yellow(s),
  low: (s) => pc.cyan(s),
  info: (s) => pc.dim(s),
};

function badge(severity: Severity): string {
  return SEVERITY_STYLE[severity](severity.toUpperCase().padEnd(8));
}

function formatFinding(finding: Finding): string {
  const lines: string[] = [];
  const where =
    finding.location.kind === "server"
      ? "server"
      : `${finding.location.kind} ${pc.bold(finding.location.name)}` +
        (finding.location.field ? pc.dim(` › ${finding.location.field}`) : "");
  lines.push(`  ${badge(finding.severity)} ${pc.dim(finding.ruleId)}`);
  lines.push(`           ${finding.message}`);
  lines.push(`           ${pc.dim("at")} ${where}`);
  if (finding.evidence) {
    lines.push(`           ${pc.dim("evidence:")} ${pc.italic(finding.evidence)}`);
  }
  lines.push(`           ${pc.dim("fix:")} ${finding.remediation}`);
  return lines.join("\n");
}

export function renderPretty(result: ScanResult): string {
  const { snapshot, findings } = result;
  const lines: string[] = [];

  const server = snapshot.probe.serverInfo;
  lines.push("");
  lines.push(
    `${pc.bold("mcpvet")} ${pc.dim("scanned")} ${pc.bold(
      server?.name ?? snapshot.target,
    )}${server?.version ? pc.dim(` v${server.version}`) : ""} ${pc.dim(
      `(${snapshot.transport}, ${snapshot.tools.length} tools, ${snapshot.resources.length} resources, ${snapshot.prompts.length} prompts)`,
    )}`,
  );
  lines.push("");

  if (findings.length === 0) {
    lines.push(pc.green("  ✓ No findings. Server surface looks clean."));
    lines.push("");
    return lines.join("\n");
  }

  for (const finding of findings) {
    lines.push(formatFinding(finding));
    lines.push("");
  }

  const counts = new Map<Severity, number>();
  for (const f of findings) counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
  const summary = (["critical", "high", "medium", "low", "info"] as const)
    .filter((s) => counts.has(s))
    .map((s) => SEVERITY_STYLE[s](`${counts.get(s)} ${s}`))
    .join(pc.dim(", "));
  lines.push(
    `${pc.bold(`${findings.length} finding${findings.length === 1 ? "" : "s"}`)} ${pc.dim("(")}${summary}${pc.dim(")")} ${pc.dim(`in ${result.durationMs}ms`)}`,
  );

  if (result.ruleErrors.length > 0) {
    lines.push(
      pc.dim(
        `${result.ruleErrors.length} rule(s) errored internally: ${result.ruleErrors
          .map((e) => e.ruleId)
          .join(", ")}`,
      ),
    );
  }
  lines.push("");
  return lines.join("\n");
}
