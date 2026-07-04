/**
 * End-to-end over the HTTP transport: spawn the streamable-HTTP fixture on an
 * OS-assigned port, read the port from its ready line, scan it, and assert
 * findings.
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureSnapshot } from "../src/connector/index.js";
import { runRules } from "../src/engine.js";
import { allRules } from "../src/rules/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tsx = path.join(here, "..", "node_modules", ".bin", "tsx");
const serverScript = path.join(here, "http-server.ts");

let child: ChildProcess;
let port: number;

beforeAll(async () => {
  // Single shell string (no separate args array) so the cross-platform .bin
  // shim runs without triggering the DEP0190 shell-with-args warning.
  // PORT=0 lets the OS assign a free port, which the fixture echoes back.
  child = spawn(`"${tsx}" "${serverScript}"`, {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "ignore"],
    shell: true,
  });
  port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("server did not start")),
      15_000,
    );
    let buffered = "";
    child.stdout?.on("data", (buf: Buffer) => {
      buffered += buf.toString();
      const match = buffered.match(/listening (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`fixture exited early with code ${code}`));
    });
  });
}, 20_000);

afterAll(() => {
  // With shell:true the spawned pid is the shell; on Windows child.kill()
  // would orphan the grandchild node process, so kill the whole tree.
  if (child?.pid === undefined) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
  } else {
    child.kill();
  }
});

describe("e2e: http transport", () => {
  it("connects over http and finds the leaked token", async () => {
    const snapshot = await captureSnapshot(`http://localhost:${port}/mcp`, {
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
