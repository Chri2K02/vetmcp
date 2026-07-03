/**
 * End-to-end over the HTTP transport: spawn the streamable-HTTP fixture on an
 * ephemeral port, wait for its ready line, scan it, and assert findings.
 */
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureSnapshot } from "../src/connector/index.js";
import { runRules } from "../src/engine.js";
import { allRules } from "../src/rules/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tsx = path.join(here, "..", "node_modules", ".bin", "tsx");
const PORT = 39231;

let child: ChildProcess;

beforeAll(async () => {
  child = spawn(tsx, [path.join(here, "http-server.ts")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "ignore"],
    shell: process.platform === "win32",
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 15_000);
    child.stdout?.on("data", (buf: Buffer) => {
      if (buf.toString().includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("error", reject);
  });
}, 20_000);

afterAll(() => {
  child?.kill();
});

describe("e2e: http transport", () => {
  it("connects over http and finds the leaked token", async () => {
    const snapshot = await captureSnapshot(`http://localhost:${PORT}/mcp`, {
      transport: "http",
      timeoutMs: 15_000,
    });
    expect(snapshot.transport).toBe("http");
    expect(snapshot.probe.initialized).toBe(true);
    expect(snapshot.tools.length).toBe(1);

    const result = runRules(snapshot, allRules);
    const fired = new Set(result.findings.map((f) => f.ruleId));
    expect(fired).toContain("secrets/known-pattern");
  }, 25_000);
});
