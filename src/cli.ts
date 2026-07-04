#!/usr/bin/env node
/**
 * vetmcp CLI.
 *
 * Exit codes: 0 = clean (below fail threshold), 1 = findings at/above
 * threshold, 2 = scan could not run (connection/config error).
 */
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig, parseSeverity } from "./config.js";
import { captureSnapshot } from "./connector/index.js";
import { runRules, shouldFail } from "./engine.js";
import { render, type ReporterName } from "./reporters/index.js";
import { allRules } from "./rules/index.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("vetmcp")
  .description(
    "Security scanner for MCP servers — npm audit for the Model Context Protocol.",
  )
  .version(VERSION)
  .argument(
    "[target]",
    'stdio command ("node server.js") or http(s) URL of the MCP server',
  )
  .option("-t, --transport <transport>", "force transport: stdio | http")
  .option(
    "-r, --reporter <reporter>",
    "output format: pretty | json | sarif",
    "pretty",
  )
  .option(
    "--fail-on <severity>",
    "minimum severity that fails the scan: critical | high | medium | low | info",
  )
  .option("--ignore <rules>", "comma-separated rule IDs or category/* globs")
  .option("--timeout <ms>", "per-operation timeout in milliseconds", "30000")
  .option("--list-rules", "print all registered rules and exit")
  .action(async (target: string | undefined, options) => {
    try {
      if (options.listRules) {
        for (const rule of allRules) {
          console.log(
            `${rule.meta.id.padEnd(36)} ${rule.meta.defaultSeverity.padEnd(9)} ${rule.meta.name}`,
          );
        }
        return;
      }
      if (!target) {
        throw new Error("Missing target. Pass a stdio command or http(s) URL.");
      }

      const transport = options.transport as "stdio" | "http" | undefined;
      if (transport && transport !== "stdio" && transport !== "http") {
        throw new Error(`Invalid transport "${transport}". Use stdio or http.`);
      }

      const reporter = options.reporter as ReporterName;
      if (!["pretty", "json", "sarif"].includes(reporter)) {
        throw new Error(
          `Invalid reporter "${reporter}". Use pretty, json, or sarif.`,
        );
      }

      const config = await loadConfig(process.cwd());
      if (options.failOn) config.failOn = parseSeverity(options.failOn);
      if (options.ignore) {
        config.ignoreRules = [
          ...config.ignoreRules,
          ...String(options.ignore)
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
        ];
      }

      const timeoutMs = Number(options.timeout);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`Invalid timeout "${options.timeout}".`);
      }

      const snapshot = await captureSnapshot(target, { transport, timeoutMs });
      const result = runRules(snapshot, allRules, config);
      console.log(render(reporter, result, allRules));

      process.exitCode = shouldFail(result, config.failOn) ? 1 : 0;
    } catch (error) {
      console.error(
        pc.red(`vetmcp: ${error instanceof Error ? error.message : String(error)}`),
      );
      process.exitCode = 2;
    }
  });

program.parseAsync(process.argv);
