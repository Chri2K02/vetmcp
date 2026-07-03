import { describe, expect, it } from "vitest";
import { makeSnapshot, makeTool } from "../testing/snapshotFactory.js";
import {
  missingDescriptionRule,
  missingInputSchemaRule,
  permissiveObjectRule,
  untypedParameterRule,
} from "./schema.js";

describe("schema/missing-input-schema", () => {
  it("flags tools without a schema", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool({ inputSchema: undefined })],
    });
    expect(missingInputSchemaRule.check(snapshot)).toHaveLength(1);
  });

  it("accepts an explicit empty object schema", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool({ inputSchema: { type: "object", properties: {} } })],
    });
    expect(missingInputSchemaRule.check(snapshot)).toHaveLength(0);
  });
});

describe("schema/missing-description", () => {
  it("flags tools without descriptions", () => {
    const snapshot = makeSnapshot({
      tools: [makeTool({ description: undefined })],
    });
    expect(missingDescriptionRule.check(snapshot)).toHaveLength(1);
  });

  it("flags whitespace-only descriptions", () => {
    const snapshot = makeSnapshot({ tools: [makeTool({ description: "  " })] });
    expect(missingDescriptionRule.check(snapshot)).toHaveLength(1);
  });
});

describe("schema/additional-properties", () => {
  it("flags object schemas that accept undeclared properties", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        }),
      ],
    });
    expect(permissiveObjectRule.check(snapshot)).toHaveLength(1);
  });

  it("accepts schemas with additionalProperties: false", () => {
    const snapshot = makeSnapshot({ tools: [makeTool()] });
    expect(permissiveObjectRule.check(snapshot)).toHaveLength(0);
  });
});

describe("schema/untyped-parameter", () => {
  it("flags parameters with no type information", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          inputSchema: {
            type: "object",
            properties: { anything: { description: "who knows" } },
          },
        }),
      ],
    });
    expect(untypedParameterRule.check(snapshot)).toHaveLength(1);
  });

  it("accepts enum-typed parameters", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          inputSchema: {
            type: "object",
            properties: { mode: { enum: ["a", "b"] } },
            additionalProperties: false,
          },
        }),
      ],
    });
    expect(untypedParameterRule.check(snapshot)).toHaveLength(0);
  });
});
