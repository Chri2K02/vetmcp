import type { Rule, ScanResult } from "../types.js";
import { renderJson } from "./json.js";
import { renderPretty } from "./pretty.js";
import { renderSarif } from "./sarif.js";

export type ReporterName = "pretty" | "json" | "sarif";

export function render(
  reporter: ReporterName,
  result: ScanResult,
  rules: Rule[],
): string {
  switch (reporter) {
    case "pretty":
      return renderPretty(result);
    case "json":
      return renderJson(result);
    case "sarif":
      return renderSarif(result, rules);
  }
}

export { renderJson, renderPretty, renderSarif };
