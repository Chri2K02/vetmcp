/** Machine-readable JSON report for CI pipelines and tooling. */
import type { ScanResult } from "../types.js";

export function renderJson(result: ScanResult): string {
  return JSON.stringify(
    {
      tool: "vetmcp",
      version: 1,
      target: result.snapshot.target,
      transport: result.snapshot.transport,
      server: result.snapshot.probe.serverInfo ?? null,
      startedAt: result.startedAt,
      durationMs: result.durationMs,
      surface: {
        tools: result.snapshot.tools.length,
        resources: result.snapshot.resources.length,
        prompts: result.snapshot.prompts.length,
      },
      findings: result.findings,
      ruleErrors: result.ruleErrors,
    },
    null,
    2,
  );
}
