import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe("published MCP stdio executable", () => {
  it("negotiates over a real child process without stdout pollution", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(import.meta.dirname, "../dist/index.js")],
      stderr: "pipe",
    });
    client = new Client({ name: "stdio-test", version: "1" });
    await client.connect(transport);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "projects",
      "activate_project",
      "query_current_mindmap",
      "edit_current_mindmap",
    ]);
    expect(
      listed.tools.find((tool) => tool.name === "projects")?.inputSchema,
    ).toHaveProperty("properties.action.enum", ["list", "create"]);
    expect(
      listed.tools.find((tool) => tool.name === "query_current_mindmap")
        ?.inputSchema,
    ).toHaveProperty("properties.mode.enum", [
      "outline",
      "subtree",
      "search",
    ]);
  });
});
