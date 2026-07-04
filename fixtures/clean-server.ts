/**
 * A well-behaved MCP server: honest descriptions, typed and constrained
 * schemas, no dangerous capabilities. vetmcp should report zero findings.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "clean-demo", version: "1.0.0" });

server.registerTool(
  "get_weather",
  {
    description: "Returns the current weather for a city.",
    inputSchema: { city: z.string().describe("City name, e.g. 'Paris'.") },
  },
  async ({ city }) => ({
    content: [{ type: "text", text: `Sunny in ${city}.` }],
  }),
);

server.registerTool(
  "convert_currency",
  {
    description: "Converts an amount between two supported currencies.",
    inputSchema: {
      amount: z.number().describe("Amount to convert."),
      from: z.enum(["USD", "EUR", "GBP"]).describe("Source currency."),
      to: z.enum(["USD", "EUR", "GBP"]).describe("Target currency."),
    },
  },
  async ({ amount, to }) => ({
    content: [{ type: "text", text: `${amount} ${to}` }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
