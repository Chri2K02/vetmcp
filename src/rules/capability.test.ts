import { describe, expect, it } from "vitest";
import { makeSnapshot, makeTool } from "../testing/snapshotFactory.js";
import {
  execSurfaceRule,
  unconstrainedPathRule,
  urlFetchRule,
} from "./capability.js";

describe("capability/exec-surface", () => {
  it("flags tools that execute shell commands", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          name: "run_command",
          description: "Executes a shell command on the host.",
        }),
      ],
    });
    const findings = execSurfaceRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("high");
  });

  it("stays quiet on a weather tool", () => {
    expect(
      execSurfaceRule.check(makeSnapshot({ tools: [makeTool()] })),
    ).toHaveLength(0);
  });
});

describe("capability/unconstrained-path", () => {
  it("flags file-writing tools with unconstrained path params", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          name: "write_file",
          description: "Writes content to a file.",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Target path." },
              content: { type: "string" },
            },
          },
        }),
      ],
    });
    const findings = unconstrainedPathRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.location.field).toBe("inputSchema.properties.path");
  });

  it("accepts constrained path params", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          name: "write_file",
          description: "Writes content to a file inside the workspace.",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                pattern: "^workspace/[\\w./-]+$",
              },
            },
          },
        }),
      ],
    });
    expect(unconstrainedPathRule.check(snapshot)).toHaveLength(0);
  });
});

describe("capability/url-fetch", () => {
  it("flags fetch tools with unconstrained url params", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          name: "fetch_url",
          description: "Downloads the given URL.",
          inputSchema: {
            type: "object",
            properties: { url: { type: "string" } },
          },
        }),
      ],
    });
    const findings = urlFetchRule.check(snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("fetch_url");
  });

  it("accepts format/pattern-constrained url params", () => {
    const snapshot = makeSnapshot({
      tools: [
        makeTool({
          name: "fetch_url",
          description: "Downloads from the docs site.",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", pattern: "^https://docs\\.example\\.com/" },
            },
          },
        }),
      ],
    });
    expect(urlFetchRule.check(snapshot)).toHaveLength(0);
  });
});
