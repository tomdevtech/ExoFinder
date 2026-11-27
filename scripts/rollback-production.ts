/**
 * Rolls Vercel production back to the previous deployment. It is run by hand, when a deployment that
 * passed its smoke test and went live turns out to be broken.
 *
 *   FAILED_DEPLOYMENT_URL=https://exofinder-abc123.vercel.app npm run deploy:rollback
 *
 * It also needs VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID. Only the code is
 * rolled back; migrations stay applied, so old code must cope with the new schema
 * (see docs/DEPLOYMENT.md).
 */
import { spawnSync } from "node:child_process";
import { pickRollbackTarget } from "@/deploy/rollback";

/** The CLI version is pinned so a new release cannot change the rollback behaviour. */
const VERCEL_CLI = "vercel@65.9.0";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. See docs/DEPLOYMENT.md, "Smoke test before going live".`);
  return value;
}

function vercel(args: string[], token: string): string {
  const result = spawnSync("npx", ["-y", VERCEL_CLI, ...args, "--token", token], {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`vercel ${args[0]} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** Parses CLI JSON output, skipping any notice printed before it. */
function parseJson(output: string): unknown {
  const start = output.search(/[[{]/);
  if (start < 0) throw new Error(`No JSON in the output of the Vercel CLI:\n${output}`);
  return JSON.parse(output.slice(start));
}

function main() {
  const token = required("VERCEL_TOKEN");
  required("VERCEL_ORG_ID");
  required("VERCEL_PROJECT_ID");
  const failed = required("FAILED_DEPLOYMENT_URL");

  const listed = vercel(["list", "--environment", "production", "--status", "READY", "--json", "--limit", "20"], token);
  const target = pickRollbackTarget(parseJson(listed), failed);
  if (!target) {
    throw new Error("There is no earlier production deployment to roll back to.");
  }

  console.log(`Rolling back from ${failed} to ${target} …`);
  vercel(["rollback", target, "--yes", "--timeout", "5m"], token);
  console.log(`Done: ${target} is live again.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
