/**
 * Dangerous capability surface: tools whose name/description/schema imply
 * command execution, unconstrained filesystem access, or arbitrary URL fetch.
 * These are not vulnerabilities by themselves — they are high-blast-radius
 * capabilities that deserve explicit constraints and review.
 */
import type { Finding, Rule, SnapshotTool } from "../types.js";

// Matched against normalized text (underscores/hyphens become spaces), so
// "fetch_url" and "run-command" hit ordinary word boundaries.
const EXEC_SIGNS =
  /\b(?:exec(?:ute[sd]?|utes|uting)?|shell|bash|powershell|cmd\.exe|subprocess|spawn|eval|run (?:command|script|code)s?)\b/i;

const FS_WRITE_SIGNS =
  /\b(?:write|delete|remove|unlink|overwrite|truncate|move|rename)[sd]?(?:\s+(?:file|files|dir|directory|path|folder))?\b/i;

const URL_FETCH_SIGNS =
  /\b(?:fetch(?:es|ing)?|download(?:s|ing)?|curl|wget|http (?:get|post|request)|open url|crawl(?:s|ing)?|scrape[sd]?)\b/i;

interface SchemaProperty {
  name: string;
  schema: Record<string, unknown>;
}

function stringProperties(tool: SnapshotTool): SchemaProperty[] {
  const properties = tool.inputSchema?.properties;
  if (!properties || typeof properties !== "object") return [];
  return Object.entries(properties)
    .filter(
      (entry): entry is [string, Record<string, unknown>] =>
        typeof entry[1] === "object" && entry[1] !== null,
    )
    .filter(([, schema]) => schema.type === "string" || schema.type === undefined)
    .map(([name, schema]) => ({ name, schema }));
}

function isConstrained(schema: Record<string, unknown>): boolean {
  return (
    schema.enum !== undefined ||
    schema.pattern !== undefined ||
    schema.format !== undefined ||
    schema.const !== undefined
  );
}

function toolText(tool: SnapshotTool): string {
  return `${tool.name} ${tool.description ?? ""}`.replace(/[_-]/g, " ");
}

export const execSurfaceRule: Rule = {
  meta: {
    id: "capability/exec-surface",
    name: "Command execution surface",
    description:
      "A tool appears to execute shell commands, scripts, or arbitrary code. Combined with model-controlled input this is remote code execution by design.",
    defaultSeverity: "high",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      const match = toolText(tool).match(EXEC_SIGNS);
      if (match) {
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Tool "${tool.name}" exposes a command/code execution surface ("${match[0]}").`,
          location: { kind: "tool", name: tool.name },
          remediation:
            "If execution is intentional, constrain it: allowlist commands, run in a sandbox, require human approval (annotations.destructiveHint), and document the blast radius. If not intentional, rename/redesign the tool.",
        });
      }
    }
    return findings;
  },
};

export const unconstrainedPathRule: Rule = {
  meta: {
    id: "capability/unconstrained-path",
    name: "Unconstrained filesystem write/delete",
    description:
      "A tool that writes or deletes files accepts a path parameter with no constraints (no pattern, enum, or format), allowing the model to target any location the process can reach.",
    defaultSeverity: "medium",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      if (!FS_WRITE_SIGNS.test(toolText(tool))) continue;
      for (const prop of stringProperties(tool)) {
        const looksLikePath = /\b(?:path|file|dir|directory|dest|target|location)\b/i.test(
          prop.name,
        );
        if (looksLikePath && !isConstrained(prop.schema)) {
          findings.push({
            ruleId: this.meta.id,
            severity: this.meta.defaultSeverity,
            message: `Tool "${tool.name}" performs filesystem writes with unconstrained path parameter "${prop.name}".`,
            location: {
              kind: "tool",
              name: tool.name,
              field: `inputSchema.properties.${prop.name}`,
            },
            remediation:
              "Constrain the parameter (pattern anchored to an allowed root, or an enum of permitted locations) and validate server-side that resolved paths stay inside the sandbox root.",
          });
        }
      }
    }
    return findings;
  },
};

export const urlFetchRule: Rule = {
  meta: {
    id: "capability/url-fetch",
    name: "Arbitrary URL fetch (SSRF surface)",
    description:
      "A tool fetches URLs and accepts an unconstrained URL parameter. From inside a private network this is a server-side request forgery primitive (cloud metadata endpoints, internal services).",
    defaultSeverity: "medium",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const tool of snapshot.tools) {
      if (!URL_FETCH_SIGNS.test(toolText(tool))) continue;
      for (const prop of stringProperties(tool)) {
        const looksLikeUrl = /\b(?:url|uri|link|endpoint|address)\b/i.test(prop.name);
        if (looksLikeUrl && !isConstrained(prop.schema)) {
          findings.push({
            ruleId: this.meta.id,
            severity: this.meta.defaultSeverity,
            message: `Tool "${tool.name}" fetches URLs with unconstrained parameter "${prop.name}".`,
            location: {
              kind: "tool",
              name: tool.name,
              field: `inputSchema.properties.${prop.name}`,
            },
            remediation:
              "Restrict the URL parameter (pattern or allowlist of hosts) and block private/link-local ranges (169.254.0.0/16, 10.0.0.0/8, localhost) server-side before fetching.",
          });
        }
      }
    }
    return findings;
  },
};

export const capabilityRules: Rule[] = [
  execSurfaceRule,
  unconstrainedPathRule,
  urlFetchRule,
];
