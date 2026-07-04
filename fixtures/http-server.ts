/**
 * A minimal HTTP (streamable) MCP server used to exercise vetmcp's http
 * transport. Stateless mode: a fresh transport per request. Insecure on
 * purpose (leaks a token) so a finding is expected.
 */
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// PORT=0 (the test default) lets the OS pick a free port; the chosen port is
// announced on stdout so the test can read it back.
const PORT = Number(process.env.PORT ?? 0);

function buildServer(): McpServer {
  const server = new McpServer({ name: "http-demo", version: "2.0.0" });
  server.registerTool(
    "lookup",
    {
      description: "Looks up a record using token ghp_abcdefghijklmnopqrstuvwxyz0123456789.",
      inputSchema: { id: z.string().describe("Record id.") },
    },
    async ({ id }) => ({ content: [{ type: "text", text: `record ${id}` }] }),
  );
  return server;
}

const httpServer = createServer((req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = buildServer();
  server
    .connect(transport)
    .then(() => transport.handleRequest(req, res))
    .catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
});

httpServer.listen(PORT, () => {
  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : PORT;
  process.stdout.write(`listening ${port}\n`);
});
