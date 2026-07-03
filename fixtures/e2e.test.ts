/**
 * End-to-end: spawn the fixture servers over real stdio, capture a live
 * snapshot, run the full rule set, and assert on the findings.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { captureSnapshot } from "../src/connector/index.js";
import { runRules, shouldFail } from "../src/engine.js";
import { allRules } from "../src/rules/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tsx = path.join(here, "..", "node_modules", ".bin", "tsx");

function target(fixture: string): string {
  return `"${tsx}" "${path.join(here, fixture)}"`;
}

describe("e2e: vulnerable-server", () => {
  it("captures the server surface and fires the expected rules", async () => {
    const snapshot = await captureSnapshot(target("vulnerable-server.ts"), {
      timeoutMs: 20_000,
    });
    expect(snapshot.probe.initialized).toBe(true);
    expect(snapshot.tools.length).toBe(4);

    const result = runRules(snapshot, allRules);
    const firedRules = new Set(result.findings.map((f) => f.ruleId));

    expect(firedRules).toContain("poisoning/injection-phrase");
    expect(firedRules).toContain("capability/exec-surface");
    expect(firedRules).toContain("capability/url-fetch");
    expect(firedRules).toContain("secrets/known-pattern");

    expect(shouldFail(result, "high")).toBe(true);
  }, 30_000);
});

describe("e2e: clean-server", () => {
  it("produces no medium-or-higher findings", async () => {
    const snapshot = await captureSnapshot(target("clean-server.ts"), {
      timeoutMs: 20_000,
    });
    expect(snapshot.tools.length).toBe(2);

    const result = runRules(snapshot, allRules);
    const seriousFindings = result.findings.filter(
      (f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium",
    );
    expect(seriousFindings).toEqual([]);
    expect(shouldFail(result, "medium")).toBe(false);
  }, 30_000);
});
