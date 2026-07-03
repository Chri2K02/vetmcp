/**
 * Secrets leakage: credentials exposed in tool metadata, prompt templates, or
 * resource contents that every connected client (and model) can read.
 */
import type { Finding, Rule } from "../types.js";
import { collectTextSources, excerpt } from "./textSources.js";

interface SecretPattern {
  pattern: RegExp;
  label: string;
}

const KNOWN_PATTERNS: SecretPattern[] = [
  { pattern: /\bAKIA[0-9A-Z]{16}\b/, label: "AWS access key ID" },
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, label: "GitHub token" },
  { pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: "Slack token" },
  { pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, label: "Anthropic API key" },
  { pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/, label: "OpenAI-style API key" },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/, label: "Google API key" },
  {
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
    label: "private key material",
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s/:]+:[^@\s]+@/i,
    label: "connection string with embedded credentials",
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    label: "JWT",
  },
];

// key/token/secret/password assignments with a long opaque value.
const ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|password|passwd)\b\s*[:=]\s*["']?([A-Za-z0-9+/_-]{16,})["']?/i;

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export const knownSecretPatternRule: Rule = {
  meta: {
    id: "secrets/known-pattern",
    name: "Known credential pattern exposed",
    description:
      "A string matching a well-known credential format (cloud API key, token, private key, connection string) appears in server-advertised text.",
    defaultSeverity: "critical",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const source of collectTextSources(snapshot)) {
      for (const { pattern, label } of KNOWN_PATTERNS) {
        const match = source.text.match(pattern);
        if (match) {
          findings.push({
            ruleId: this.meta.id,
            severity: this.meta.defaultSeverity,
            message: `Possible ${label} exposed in ${source.location.kind} "${source.location.name}" (${source.location.field}).`,
            location: source.location,
            evidence: redact(match[0]),
            remediation:
              "Rotate this credential immediately and remove it from server metadata/resources. Load secrets from the environment at call time; never embed them in advertised content.",
          });
        }
      }
    }
    return findings;
  },
};

export const secretAssignmentRule: Rule = {
  meta: {
    id: "secrets/assignment",
    name: "Credential-like assignment exposed",
    description:
      "A key/token/secret/password assignment with a long, high-entropy value appears in server-advertised text.",
    defaultSeverity: "high",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const source of collectTextSources(snapshot)) {
      const match = source.text.match(ASSIGNMENT_PATTERN);
      if (!match) continue;
      const value = match[2] ?? "";
      // Entropy gate keeps placeholders like "your-api-key-here" from firing.
      if (shannonEntropy(value) < 3.5) continue;
      findings.push({
        ruleId: this.meta.id,
        severity: this.meta.defaultSeverity,
        message: `Credential-like assignment ("${match[1]}") exposed in ${source.location.kind} "${source.location.name}" (${source.location.field}).`,
        location: source.location,
        evidence: `${match[1]}=${redact(value)}`,
        remediation:
          "Remove the value from advertised content and rotate it if real. Reference secrets by environment variable name instead of value.",
      });
    }
    return findings;
  },
};

function redact(secret: string): string {
  const shown = excerpt(secret, 40);
  if (shown.length <= 8) return "****";
  return `${shown.slice(0, 4)}…${shown.slice(-4)} (redacted)`;
}

export const secretsRules: Rule[] = [knownSecretPatternRule, secretAssignmentRule];
