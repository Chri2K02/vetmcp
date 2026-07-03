/** Parsing of the CLI target argument into a connectable description. */

export type TargetSpec =
  | { transport: "http"; url: string }
  | { transport: "stdio"; command: string; args: string[] };

/**
 * Splits a command line into tokens, honoring single and double quotes.
 * Kept deliberately simple — no escapes, no globbing.
 */
export function tokenize(commandLine: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(commandLine)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return tokens;
}

export function parseTarget(
  target: string,
  forcedTransport?: "stdio" | "http",
): TargetSpec {
  const isUrl = /^https?:\/\//i.test(target);
  const transport = forcedTransport ?? (isUrl ? "http" : "stdio");

  if (transport === "http") {
    if (!isUrl) {
      throw new Error(
        `Target "${target}" is not a valid http(s) URL (required for --transport http).`,
      );
    }
    return { transport: "http", url: target };
  }

  const tokens = tokenize(target);
  const command = tokens[0];
  if (!command) {
    throw new Error("Empty stdio target. Pass a command, e.g. \"node server.js\".");
  }
  return { transport: "stdio", command, args: tokens.slice(1) };
}
