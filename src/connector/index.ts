/**
 * Connects to a target MCP server, captures everything it advertises, and
 * returns a normalized ServerSnapshot. This module is the only place that
 * talks to the network/process — rules never do I/O.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  ProbeObservations,
  ServerSnapshot,
  SnapshotPrompt,
  SnapshotResource,
  SnapshotTool,
} from "../types.js";
import { parseTarget } from "./target.js";

export interface ConnectOptions {
  /** Force the transport instead of inferring from the target string. */
  transport?: "stdio" | "http";
  /** Per-operation timeout in milliseconds. */
  timeoutMs?: number;
  /** Max resources whose contents are previewed. */
  maxResourcePreviews?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const PREVIEW_BYTES = 2_048;
const DEFAULT_MAX_PREVIEWS = 10;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function captureSnapshot(
  target: string,
  options: ConnectOptions = {},
): Promise<ServerSnapshot> {
  const spec = parseTarget(target, options.transport);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxPreviews = options.maxResourcePreviews ?? DEFAULT_MAX_PREVIEWS;

  const client = new Client({ name: "mcpvet", version: "0.1.0" });
  const transport =
    spec.transport === "stdio"
      ? new StdioClientTransport({
          command: spec.command,
          args: spec.args,
          stderr: "ignore",
        })
      : new StreamableHTTPClientTransport(new URL(spec.url));

  const probe: ProbeObservations = {
    initialized: false,
    advertisedCapabilities: { tools: false, resources: false, prompts: false },
    listResults: {},
    errors: [],
  };

  try {
    await withTimeout(client.connect(transport), timeoutMs, "initialize");
  } catch (error) {
    await client.close().catch(() => {});
    throw new Error(
      `Could not connect to MCP server "${target}": ${errorMessage(error)}`,
      { cause: error },
    );
  }

  probe.initialized = true;
  const serverVersion = client.getServerVersion();
  if (serverVersion) {
    probe.serverInfo = {
      name: serverVersion.name,
      version: serverVersion.version,
    };
  }
  const caps = client.getServerCapabilities() ?? {};
  probe.advertisedCapabilities = {
    tools: caps.tools !== undefined,
    resources: caps.resources !== undefined,
    prompts: caps.prompts !== undefined,
  };

  const tools: SnapshotTool[] = [];
  const resources: SnapshotResource[] = [];
  const prompts: SnapshotPrompt[] = [];

  if (probe.advertisedCapabilities.tools) {
    try {
      const result = await withTimeout(client.listTools(), timeoutMs, "tools/list");
      probe.listResults.tools = "ok";
      for (const tool of result.tools) {
        tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
          annotations: tool.annotations as Record<string, unknown> | undefined,
        });
      }
    } catch (error) {
      probe.listResults.tools = "error";
      probe.errors.push(`tools/list failed: ${errorMessage(error)}`);
    }
  }

  if (probe.advertisedCapabilities.resources) {
    try {
      const result = await withTimeout(
        client.listResources(),
        timeoutMs,
        "resources/list",
      );
      probe.listResults.resources = "ok";
      for (const resource of result.resources) {
        resources.push({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        });
      }
    } catch (error) {
      probe.listResults.resources = "error";
      probe.errors.push(`resources/list failed: ${errorMessage(error)}`);
    }

    // Preview a bounded number of text resources so secrets rules can inspect
    // actual contents, not just metadata.
    for (const resource of resources.slice(0, maxPreviews)) {
      if (resource.mimeType && !isTextLike(resource.mimeType)) continue;
      try {
        const result = await withTimeout(
          client.readResource({ uri: resource.uri }),
          timeoutMs,
          `resources/read ${resource.uri}`,
        );
        const text = result.contents
          .map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
          .join("\n");
        if (text) resource.contentPreview = text.slice(0, PREVIEW_BYTES);
      } catch (error) {
        probe.errors.push(
          `resources/read ${resource.uri} failed: ${errorMessage(error)}`,
        );
      }
    }
  }

  if (probe.advertisedCapabilities.prompts) {
    try {
      const result = await withTimeout(
        client.listPrompts(),
        timeoutMs,
        "prompts/list",
      );
      probe.listResults.prompts = "ok";
      for (const prompt of result.prompts) {
        prompts.push({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments?.map((a) => ({
            name: a.name,
            description: a.description,
            required: a.required,
          })),
        });
      }
    } catch (error) {
      probe.listResults.prompts = "error";
      probe.errors.push(`prompts/list failed: ${errorMessage(error)}`);
    }
  }

  await client.close().catch(() => {});

  return {
    target,
    transport: spec.transport,
    tools,
    resources,
    prompts,
    probe,
  };
}

function isTextLike(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml") ||
    mimeType.includes("javascript")
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
