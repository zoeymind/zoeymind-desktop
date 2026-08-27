import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "zoeymind-pack-"));

function run(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  }).trim();
}

function pack(packageDirectory) {
  const output = JSON.parse(
    run(
      "npm",
      ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary],
      packageDirectory,
    ),
  );
  const filename = output[0]?.filename;
  if (!filename)
    throw new Error(`npm pack returned no filename for ${packageDirectory}`);
  return resolve(temporary, filename);
}

try {
  const cliTarball = pack(join(root, "apps/cli"));
  const mcpTarball = pack(join(root, "apps/mcp"));
  run("npm", ["init", "-y"], temporary);
  run(
    "npm",
    ["install", "--ignore-scripts", cliTarball, mcpTarball],
    temporary,
  );

  const cliBin = join(temporary, "node_modules/.bin/zoeymind");
  const mcpBin = join(temporary, "node_modules/.bin/zoeymind-mcp");
  const cliPackage = JSON.parse(
    readFileSync(
      join(temporary, "node_modules/@zoeymind/cli/package.json"),
      "utf8",
    ),
  );
  const mcpPackage = JSON.parse(
    readFileSync(
      join(temporary, "node_modules/@zoeymind/mcp/package.json"),
      "utf8",
    ),
  );

  if (cliPackage.bin.zoeymind !== "dist/bin.js")
    throw new Error("CLI bin contract changed");
  if (mcpPackage.bin["zoeymind-mcp"] !== "dist/index.js")
    throw new Error("MCP bin contract changed");
  if (!readFileSync(cliBin, "utf8").includes("node"))
    throw new Error("CLI executable link is missing");
  if (!readFileSync(mcpBin, "utf8").includes("node"))
    throw new Error("MCP executable link is missing");

  const cliRun = spawnSync(cliBin, ["doctor", "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      APPDATA: temporary,
      HOME: temporary,
      LOCALAPPDATA: temporary,
      XDG_DATA_HOME: temporary,
    },
  });
  const cliOutput = `${cliRun.stdout}${cliRun.stderr}`;
  const cliReport = JSON.parse(cliRun.stdout);
  if (
    cliRun.status === 0 ||
    cliReport.ok !== false ||
    cliReport.checks?.find((check) => check.id === "desktop-broker")?.status !==
      "fail"
  )
    throw new Error(`Unexpected CLI packaged result: ${cliOutput}`);

  process.stdout.write(
    `PASS packed ${basename(cliTarball)} and ${basename(mcpTarball)}\n`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
