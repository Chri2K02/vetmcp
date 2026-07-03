import type { Rule } from "../types.js";
import { capabilityRules } from "./capability.js";
import { conformanceRules } from "./conformance.js";
import { poisoningRules } from "./poisoning.js";
import { schemaRules } from "./schema.js";
import { secretsRules } from "./secrets.js";

/** Every registered rule. Add new rule modules here. */
export const allRules: Rule[] = [
  ...poisoningRules,
  ...secretsRules,
  ...capabilityRules,
  ...schemaRules,
  ...conformanceRules,
];
