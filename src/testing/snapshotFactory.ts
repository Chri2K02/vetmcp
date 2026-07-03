/** Test helper: build ServerSnapshots with minimal boilerplate. */
import type {
  ServerSnapshot,
  SnapshotPrompt,
  SnapshotResource,
  SnapshotTool,
} from "../types.js";

export function makeSnapshot(
  overrides: Partial<ServerSnapshot> = {},
): ServerSnapshot {
  return {
    target: "test://server",
    transport: "stdio",
    tools: [],
    resources: [],
    prompts: [],
    probe: {
      initialized: true,
      serverInfo: { name: "test-server", version: "1.0.0" },
      advertisedCapabilities: { tools: true, resources: false, prompts: false },
      listResults: { tools: "ok" },
      errors: [],
    },
    ...overrides,
  };
}

export function makeTool(overrides: Partial<SnapshotTool> = {}): SnapshotTool {
  return {
    name: "safe_tool",
    description: "Returns the current weather for a city.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name." },
      },
      required: ["city"],
      additionalProperties: false,
    },
    ...overrides,
  };
}

export function makeResource(
  overrides: Partial<SnapshotResource> = {},
): SnapshotResource {
  return {
    uri: "file:///docs/readme.md",
    name: "readme",
    description: "Project readme.",
    mimeType: "text/markdown",
    ...overrides,
  };
}

export function makePrompt(
  overrides: Partial<SnapshotPrompt> = {},
): SnapshotPrompt {
  return {
    name: "summarize",
    description: "Summarize a document.",
    ...overrides,
  };
}
