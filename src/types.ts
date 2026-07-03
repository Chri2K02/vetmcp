/** Shared contracts between connector, rules, engine, and reporters. */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/** A tool as advertised by the target server. */
export interface SnapshotTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface SnapshotResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  /** First bytes of the resource contents, when readable. */
  contentPreview?: string;
}

export interface SnapshotPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

/** Facts observed while probing the server, used by conformance rules. */
export interface ProbeObservations {
  initialized: boolean;
  serverInfo?: { name?: string; version?: string };
  advertisedCapabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
  /** Which list calls actually succeeded. */
  listResults: {
    tools?: "ok" | "error";
    resources?: "ok" | "error";
    prompts?: "ok" | "error";
  };
  errors: string[];
}

/** Normalized view of everything the server exposes. Input to every rule. */
export interface ServerSnapshot {
  target: string;
  transport: "stdio" | "http";
  tools: SnapshotTool[];
  resources: SnapshotResource[];
  prompts: SnapshotPrompt[];
  probe: ProbeObservations;
}

/** Where in the server surface a finding points. */
export interface FindingLocation {
  kind: "tool" | "resource" | "prompt" | "server";
  name: string;
  /** e.g. "description", "inputSchema.properties.path" */
  field?: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  location: FindingLocation;
  remediation: string;
  /** Short excerpt of the offending content, when safe to show. */
  evidence?: string;
}

export interface RuleMeta {
  id: string;
  name: string;
  description: string;
  defaultSeverity: Severity;
  /** Documentation anchor, e.g. "poisoning/injection-phrase". */
  docs?: string;
}

export interface Rule {
  meta: RuleMeta;
  check(snapshot: ServerSnapshot): Finding[];
}

export interface ScanConfig {
  /** Rule IDs (or "category/*" globs) to skip. */
  ignoreRules: string[];
  /** Minimum severity that causes a failing exit code. */
  failOn: Severity;
}

export interface ScanResult {
  snapshot: ServerSnapshot;
  findings: Finding[];
  /** Rules that threw internally (never fatal). */
  ruleErrors: Array<{ ruleId: string; error: string }>;
  startedAt: string;
  durationMs: number;
}
