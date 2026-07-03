/**
 * Schema hygiene: weak or missing input schemas make a server harder for
 * models to use safely and defeat client-side validation.
 */
import type { Finding, Rule } from "../types.js";

export const missingInputSchemaRule: Rule = {
  meta: {
    id: "schema/missing-input-schema",
    name: "Missing or empty input schema",
    description:
      "A tool advertises no input schema (or an empty one), so clients cannot validate arguments before the call reaches the server.",
    defaultSeverity: "medium",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      const schema = tool.inputSchema;
      const properties =
        schema?.properties && typeof schema.properties === "object"
          ? Object.keys(schema.properties)
          : [];
      const declaresNoParams = schema?.type === "object" && properties.length === 0;
      if (!schema) {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Tool "${tool.name}" advertises no input schema.`,
          location: { kind: "tool", name: tool.name, field: "inputSchema" },
          remediation:
            "Declare a JSON schema for the tool's arguments so clients can validate calls. If the tool takes no arguments, declare an empty object schema explicitly.",
        });
      } else if (declaresNoParams) {
        // Explicit empty object is fine — no finding.
        void 0;
      }
    }
    return findings;
  },
};

export const missingDescriptionRule: Rule = {
  meta: {
    id: "schema/missing-description",
    name: "Tool without description",
    description:
      "A tool has no description. Models pick tools by description; an undocumented tool invites misuse and misrouting.",
    defaultSeverity: "low",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      if (!tool.description || tool.description.trim() === "") {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Tool "${tool.name}" has no description.`,
          location: { kind: "tool", name: tool.name, field: "description" },
          remediation:
            "Write a one-sentence description of what the tool does and when to use it.",
        });
      }
    }
    return findings;
  },
};

export const permissiveObjectRule: Rule = {
  meta: {
    id: "schema/additional-properties",
    name: "Object schema accepts undeclared properties",
    description:
      "A tool's object schema does not set additionalProperties: false, so arbitrary extra arguments pass client validation and reach the server unchecked.",
    defaultSeverity: "low",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      const schema = tool.inputSchema;
      if (!schema || schema.type !== "object") continue;
      const hasProperties =
        schema.properties &&
        typeof schema.properties === "object" &&
        Object.keys(schema.properties).length > 0;
      if (hasProperties && schema.additionalProperties !== false) {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Tool "${tool.name}" input schema allows undeclared properties.`,
          location: {
            kind: "tool",
            name: tool.name,
            field: "inputSchema.additionalProperties",
          },
          remediation:
            'Set "additionalProperties": false on the input schema so unexpected arguments are rejected at the client.',
        });
      }
    }
    return findings;
  },
};

export const untypedParameterRule: Rule = {
  meta: {
    id: "schema/untyped-parameter",
    name: "Parameter without a type",
    description:
      "A declared parameter has no type, so any value passes validation.",
    defaultSeverity: "low",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      const properties = tool.inputSchema?.properties;
      if (!properties || typeof properties !== "object") continue;
      for (const [name, value] of Object.entries(properties)) {
        if (!value || typeof value !== "object") continue;
        const prop = value as Record<string, unknown>;
        const hasType =
          prop.type !== undefined ||
          prop.enum !== undefined ||
          prop.const !== undefined ||
          prop.anyOf !== undefined ||
          prop.oneOf !== undefined ||
          prop.allOf !== undefined ||
          prop.$ref !== undefined;
        if (!hasType) {
          findings.push({
            ruleId: this.meta.id,
            severity: this.meta.defaultSeverity,
            message: `Parameter "${name}" of tool "${tool.name}" has no type.`,
            location: {
              kind: "tool",
              name: tool.name,
              field: `inputSchema.properties.${name}`,
            },
            remediation: "Declare a type (or enum/const/anyOf) for the parameter.",
          });
        }
      }
    }
    return findings;
  },
};

export const schemaRules: Rule[] = [
  missingInputSchemaRule,
  missingDescriptionRule,
  permissiveObjectRule,
  untypedParameterRule,
];
