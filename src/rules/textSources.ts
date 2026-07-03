/** Enumerates every textual surface of a snapshot, paired with its location. */
import type { FindingLocation, ServerSnapshot } from "../types.js";

export interface TextSource {
  text: string;
  location: FindingLocation;
}

/** Recursively collect `description` strings from a JSON schema. */
function* schemaDescriptions(
  schema: Record<string, unknown>,
  path: string,
): Generator<{ text: string; field: string }> {
  if (typeof schema.description === "string") {
    yield { text: schema.description, field: `${path}.description` };
  }
  const properties = schema.properties;
  if (properties && typeof properties === "object") {
    for (const [key, value] of Object.entries(properties)) {
      if (value && typeof value === "object") {
        yield* schemaDescriptions(
          value as Record<string, unknown>,
          `${path}.properties.${key}`,
        );
      }
    }
  }
  const items = schema.items;
  if (items && typeof items === "object" && !Array.isArray(items)) {
    yield* schemaDescriptions(items as Record<string, unknown>, `${path}.items`);
  }
}

/**
 * All human/model-readable text a client would feed into an LLM context:
 * tool names + descriptions, parameter descriptions, resource metadata and
 * previewed contents, prompt metadata.
 */
export function collectTextSources(snapshot: ServerSnapshot): TextSource[] {
  const sources: TextSource[] = [];

  for (const tool of snapshot.tools) {
    if (tool.description) {
      sources.push({
        text: tool.description,
        location: { kind: "tool", name: tool.name, field: "description" },
      });
    }
    if (tool.inputSchema) {
      for (const { text, field } of schemaDescriptions(
        tool.inputSchema,
        "inputSchema",
      )) {
        sources.push({
          text,
          location: { kind: "tool", name: tool.name, field },
        });
      }
    }
  }

  for (const resource of snapshot.resources) {
    if (resource.description) {
      sources.push({
        text: resource.description,
        location: {
          kind: "resource",
          name: resource.name ?? resource.uri,
          field: "description",
        },
      });
    }
    if (resource.contentPreview) {
      sources.push({
        text: resource.contentPreview,
        location: {
          kind: "resource",
          name: resource.name ?? resource.uri,
          field: "contents",
        },
      });
    }
  }

  for (const prompt of snapshot.prompts) {
    if (prompt.description) {
      sources.push({
        text: prompt.description,
        location: { kind: "prompt", name: prompt.name, field: "description" },
      });
    }
    for (const arg of prompt.arguments ?? []) {
      if (arg.description) {
        sources.push({
          text: arg.description,
          location: {
            kind: "prompt",
            name: prompt.name,
            field: `arguments.${arg.name}.description`,
          },
        });
      }
    }
  }

  return sources;
}

/** Trim an evidence excerpt to something safe to print. */
export function excerpt(text: string, max = 120): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}
