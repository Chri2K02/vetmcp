import { describe, expect, it } from "vitest";
import { makeSnapshot, makeTool } from "../testing/snapshotFactory.js";
import {
  capabilityListFailureRule,
  duplicateToolNameRule,
  probeErrorRule,
} from "./conformance.js";

describe("conformance/list-failure", () => {
  it("flags advertised capabilities whose list call failed", () => {
    const snapshot = makeSnapshot({
      probe: {
        initialized: true,
        advertisedCapabilities: { tools: true, resources: true, prompts: false },
        listResults: { tools: "ok", resources: "error" },
        errors: [],
      },
    });
    const findings = capabilityListFailureRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("resources");
  });
});

describe("conformance/duplicate-tool-name", () => {
  it("flags duplicated tool names", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool({ name: "dup" }), makeTool({ name: "dup" })],
    });
    const findings = duplicateToolNameRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('"dup"');
  });

  it("stays quiet with unique names", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool({ name: "a" }), makeTool({ name: "b" })],
    });
    expect(duplicateToolNameRule.check(snapshot)).toHaveLength(0);
  });
});

describe("conformance/probe-error", () => {
  it("surfaces probe errors as info findings", () => {
    const snapshot = makeSnapshot({
      probe: {
        initialized: true,
        advertisedCapabilities: { tools: true, resources: false, prompts: false },
        listResults: { tools: "ok" },
        errors: ["resources/read file:///x failed: timeout"],
      },
    });
    const findings = probeErrorRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("info");
  });
});
