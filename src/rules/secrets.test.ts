import { describe, expect, it } from "vitest";
import { makeResource, makeSnapshot, makeTool } from "../testing/snapshotFactory.js";
import { knownSecretPatternRule, secretAssignmentRule } from "./secrets.js";

describe("secrets/known-pattern", () => {
  it("flags an AWS access key in a tool description", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({ description: "Uses key AKIAIOSFODNN7EXAMPLE to call AWS." }),
      ],
    });
    const findings = knownSecretPatternRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.message).toContain("AWS access key");
  });

  it("redacts the evidence", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool({ description: "key AKIAIOSFODNN7EXAMPLE" })],
    });
    const finding = knownSecretPatternRule.check(snapshot)[0];
    expect(finding?.evidence).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(finding?.evidence).toContain("redacted");
  });

  it("flags credentials in previewed resource contents", () => {
    const snapshot = makeSnapshot({
      resources: [
        makeResource({
          contentPreview:
            "db: postgres://admin:hunter2secret@db.internal:5432/prod",
        }),
      ],
    });
    const findings = knownSecretPatternRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("connection string");
  });

  it("flags private key material", () => {
    const snapshot = makeSnapshot({
      resources: [
        makeResource({
          contentPreview: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB...",
        }),
      ],
    });
    expect(knownSecretPatternRule.check(snapshot)).toHaveLength(1);
  });

  it("stays quiet on clean content", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool()],
      resources: [makeResource({ contentPreview: "Just a readme." })],
    });
    expect(knownSecretPatternRule.check(snapshot)).toHaveLength(0);
  });
});

describe("secrets/assignment", () => {
  it("flags high-entropy credential assignments", () => {
    const snapshot = makeSnapshot({
      resources: [
        makeResource({
          contentPreview: 'api_key = "9xK2mQ7pL4nR8vT1wY5zB3cD6fG0hJs"',
        }),
      ],
    });
    const findings = secretAssignmentRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("ignores low-entropy placeholders", () => {
    const snapshot = makeSnapshot({
      resources: [
        makeResource({ contentPreview: 'api_key = "your-api-key-here"' }),
      ],
    });
    expect(secretAssignmentRule.check(snapshot)).toHaveLength(0);
  });
});
