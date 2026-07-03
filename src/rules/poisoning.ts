/**
 * Tool poisoning: instructions hidden in tool/resource/prompt metadata that
 * try to steer the model instead of describing functionality.
 */
import type { Finding, Rule } from "../types.js";
import { collectTextSources, excerpt } from "./textSources.js";

interface PhrasePattern {
  pattern: RegExp;
  label: string;
}

const INJECTION_PHRASES: PhrasePattern[] = [
  {
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|messages?|context)/i,
    label: "instruction-override phrase",
  },
  {
    pattern: /disregard\s+(?:all\s+)?(?:previous|prior|your)\s+(?:instructions?|rules?|guidelines?)/i,
    label: "instruction-override phrase",
  },
  {
    pattern: /do\s+not\s+(?:tell|inform|mention|reveal|show|disclose)\s+(?:this\s+)?(?:to\s+)?the\s+user/i,
    label: "user-concealment phrase",
  },
  {
    pattern: /without\s+(?:telling|informing|notifying|asking)\s+the\s+user/i,
    label: "user-concealment phrase",
  },
  {
    pattern: /(?:keep|make)\s+this\s+(?:secret|hidden|confidential)\s+from\s+the\s+user/i,
    label: "user-concealment phrase",
  },
  {
    pattern: /you\s+(?:must|should)\s+(?:always|never|first)\b/i,
    label: "model-coercion phrase",
  },
  {
    pattern: /<\/?\s*(?:system|assistant|im_start|instructions?)\s*>/i,
    label: "role/system tag in metadata",
  },
  {
    pattern: /\[\s*system\s*(?:message|prompt)?\s*\]/i,
    label: "role/system tag in metadata",
  },
  {
    pattern: /(?:send|post|upload|forward|transmit|exfiltrate)\s+(?:the\s+|all\s+|any\s+)?(?:conversation|chat|messages?|history|credentials?|secrets?|contents?|data|results?)(?:\s+(?:history|log|logs|data|contents?))?\s+to\s+/i,
    label: "possible exfiltration instruction",
  },
];

const CROSS_TOOL_PHRASES: PhrasePattern[] = [
  {
    pattern: /before\s+(?:using|calling|invoking|running)\s+(?:any\s+other|other|another)\s+tools?/i,
    label: "cross-tool sequencing instruction",
  },
  {
    pattern: /instead\s+of\s+(?:using|calling|invoking)\s+(?:the\s+)?[\w-]+\s+tool/i,
    label: "tool-shadowing instruction",
  },
  {
    pattern: /(?:always|only)\s+use\s+this\s+tool\s+(?:for|when|instead)/i,
    label: "tool-preference coercion",
  },
];

// Zero-width chars, bidi controls, and the Unicode "tags" block — all invisible
// to a human reading the description but fully visible to the model.
const INVISIBLE_UNICODE = new RegExp(
  "[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF]" +
    "|\\uDB40[\\uDC00-\\uDC7F]",
);

export const injectionPhraseRule: Rule = {
  meta: {
    id: "poisoning/injection-phrase",
    name: "Prompt injection phrase in metadata",
    description:
      "Tool, resource, or prompt metadata contains phrases that instruct the model rather than describe functionality (instruction overrides, concealment from the user, exfiltration directions).",
    defaultSeverity: "critical",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const source of collectTextSources(snapshot)) {
      for (const { pattern, label } of INJECTION_PHRASES) {
        const match = source.text.match(pattern);
        if (match) {
          findings.push({
            ruleId: this.meta.id,
            severity: this.meta.defaultSeverity,
            message: `${capitalize(label)} found in ${source.location.kind} "${source.location.name}" (${source.location.field}).`,
            location: source.location,
            evidence: excerpt(match[0]),
            remediation:
              "Metadata should only describe what the tool does. Remove instructions aimed at the model; a legitimate description never needs to override instructions or hide anything from the user.",
          });
        }
      }
    }
    return findings;
  },
};

export const crossToolInfluenceRule: Rule = {
  meta: {
    id: "poisoning/cross-tool-influence",
    name: "Cross-tool manipulation in metadata",
    description:
      "Metadata attempts to change how or when the model uses other tools (sequencing demands, tool shadowing). A common vector for rug-pull attacks in multi-server setups.",
    defaultSeverity: "high",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const source of collectTextSources(snapshot)) {
      for (const { pattern, label } of CROSS_TOOL_PHRASES) {
        const match = source.text.match(pattern);
        if (match) {
          findings.push({
            ruleId: this.meta.id,
            severity: this.meta.defaultSeverity,
            message: `${capitalize(label)} found in ${source.location.kind} "${source.location.name}" (${source.location.field}).`,
            location: source.location,
            evidence: excerpt(match[0]),
            remediation:
              "A tool description should not dictate how other tools are used. Remove cross-tool directives; clients decide orchestration.",
          });
        }
      }
    }
    return findings;
  },
};

export const invisibleUnicodeRule: Rule = {
  meta: {
    id: "poisoning/invisible-unicode",
    name: "Invisible Unicode in metadata",
    description:
      "Metadata contains zero-width characters, bidirectional control characters, or Unicode tag characters — invisible to human reviewers but readable by the model. A known hidden-instruction smuggling channel.",
    defaultSeverity: "critical",
  },
  check(snapshot): Finding[] {
    const findings: Finding[] = [];
    for (const source of collectTextSources(snapshot)) {
      // Resource contents legitimately contain all sorts of text; only flag
      // metadata surfaces where invisible characters have no honest purpose.
      if (source.location.field === "contents") continue;
      const match = source.text.match(INVISIBLE_UNICODE);
      if (match) {
        const codePoint = match[0].codePointAt(0)?.toString(16).toUpperCase();
        findings.push({
          ruleId: this.meta.id,
          severity: this.meta.defaultSeverity,
          message: `Invisible Unicode character (U+${codePoint}) in ${source.location.kind} "${source.location.name}" (${source.location.field}).`,
          location: source.location,
          remediation:
            "Strip zero-width, bidirectional-control, and tag characters from all metadata. There is no legitimate reason for invisible characters in a tool description.",
        });
      }
    }
    return findings;
  },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const poisoningRules: Rule[] = [
  injectionPhraseRule,
  crossToolInfluenceRule,
  invisibleUnicodeRule,
];
