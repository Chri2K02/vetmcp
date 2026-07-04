/** Loads .vetmcprc.json from the working directory, merged with CLI flags. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScanConfig, Severity } from "./types.js";
import { DEFAULT_CONFIG } from "./engine.js";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export function parseSeverity(value: string): Severity {
  if ((SEVERITIES as string[]).includes(value)) return value as Severity;
  throw new Error(
    `Invalid severity "${value}". Expected one of: ${SEVERITIES.join(", ")}.`,
  );
}

export async function loadConfig(cwd: string): Promise<ScanConfig> {
  const file = path.join(cwd, ".vetmcprc.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return { ...DEFAULT_CONFIG };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Could not parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const config = { ...DEFAULT_CONFIG };
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.ignoreRules)) {
      config.ignoreRules = record.ignoreRules.filter(
        (r): r is string => typeof r === "string",
      );
    }
    if (typeof record.failOn === "string") {
      config.failOn = parseSeverity(record.failOn);
    }
  }
  return config;
}
