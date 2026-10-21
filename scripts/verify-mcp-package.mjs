import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { NPM, runWithOutput } from "./publish-workspace-utils.mjs";

// Install only the MCP runtime closure, outside the workspace and its overrides.
export async function verifyMcpPackage(packages) {
  if (!packages.some((pkg) => pkg.name === "@rawsql-ts/mcp-server")) return null;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rawsql-mcp-consumer-"));
  try {
    const names = new Set([
      "@rawsql-ts/mcp-server", "@rawsql-ts/investigation-core",
      "@rawsql-ts/sql-grep-core", "rawsql-ts",
    ]);
    const dependencies = Object.fromEntries(packages
      .filter((pkg) => names.has(pkg.name))
      .map((pkg) => [pkg.name, pathToFileURL(pkg.tarballPath).href]));
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({
      name: "mcp-runtime-consumer-check", private: true, version: "0.0.0", dependencies,
    }));
    runWithOutput(NPM, ["install", "--ignore-scripts"], { cwd: directory });
    runWithOutput(NPM, ["audit", "--omit=dev", "--audit-level=moderate"], { cwd: directory });
    runWithOutput(NPM, ["ls", "--omit=dev", "--all"], { cwd: directory });

    const consumerRequire = createRequire(path.join(directory, "package.json"));
    const mcpEntry = consumerRequire.resolve("@rawsql-ts/mcp-server");
    const mcpRequire = createRequire(mcpEntry);
    const { Client } = await import(pathToFileURL(mcpRequire.resolve("@modelcontextprotocol/sdk/client/index.js")));
    const { StdioClientTransport } = await import(pathToFileURL(mcpRequire.resolve("@modelcontextprotocol/sdk/client/stdio.js")));
    const manifestPath = path.resolve(path.dirname(mcpEntry), "../package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const executable = path.resolve(path.dirname(manifestPath), manifest.bin["rawsql-ts-mcp"]);
    const installedBin = path.join(directory, "node_modules", ".bin", process.platform === "win32" ? "rawsql-ts-mcp.cmd" : "rawsql-ts-mcp");
    assert.ok(fs.existsSync(installedBin), "npm must install the MCP executable");
    // Exercise the installed bin on Unix, and its declared JS target on Windows.
    const transport = new StdioClientTransport({
      command: process.platform === "win32" ? process.execPath : installedBin,
      args: [...(process.platform === "win32" ? [executable] : []), "--workspace", directory],
      cwd: directory,
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => { stderr += chunk; });
    const client = new Client({ name: "packed-mcp-check", version: "1.0.0" });
    const timeout = setTimeout(() => {
      console.error("Packed MCP stdio verification timed out");
      void transport.close();
    }, 30_000);
    try {
      await client.connect(transport, { timeout: 10_000 });
      const listed = await client.listTools({}, { timeout: 10_000 });
      assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
        "validate_sql", "inspect_query_contract", "analyze_query_structure",
        "analyze_column_lineage", "slice_query", "create_fixture_extraction_plan",
        "find_query_usage", "extract_cte_query", "optimize_sql_conditions", "format_sql",
      ].sort());
      const result = await client.callTool({
        name: "validate_sql", arguments: { sql: "select 1 as value" },
      }, undefined, { timeout: 10_000 });
      assert.notEqual(result.isError, true);
      assert.equal(result.structuredContent?.valid, true);
      console.log("[packed-mcp] initialize, tools/list (10 tools), validate_sql: passed");
      return { toolCount: listed.tools.length, valid: result.structuredContent.valid, audit: "passed" };
    } catch (error) {
      if (stderr) console.error(stderr);
      throw error;
    } finally {
      clearTimeout(timeout);
      await client.close();
      await transport.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
