/**
 * The rules that keep the code of a pull request away from the secrets of the deployment. GitHub only
 * applies a workflow once it is merged, so a broken rule would show up only when it is too late.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(`.github/workflows/${file}`, "utf8").replace(/\r\n/g, "\n");

/** The steps of a job as text, each from its `- ` line up to the next one. */
function steps(source: string, job: string): string[] {
  const start = source.indexOf(`\n  ${job}:\n`);
  expect(start, job).toBeGreaterThan(-1);
  const rest = source.slice(start + job.length + 4);
  const end = rest.search(/\n  [a-z-]+:\n/);
  const body = end === -1 ? rest : rest.slice(0, end);
  return body.split(/\n      - /).slice(1);
}

describe("deploy.yml", () => {
  const deploy = read("deploy.yml");

  it("deploys only after CI has passed, never a fork's branch and never one of Dependabot", () => {
    expect(deploy).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deploy).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(deploy).toContain("github.event.workflow_run.actor.login != 'dependabot[bot]'");
    expect(deploy).toContain("!startsWith(github.event.workflow_run.head_branch, 'dependabot/')");
  });

  it("puts no value of the event into a script, only into variables", () => {
    for (const step of steps(deploy, "deploy")) {
      const script = step.split("\n        run: |")[1] ?? "";
      expect(script, step.slice(0, 40)).not.toContain("${{");
    }
  });
});

describe("deploy-check.yml", () => {
  const check = read("deploy-check.yml");

  it("runs the smoke test as it is on main, not the deployed commit's", () => {
    const checkout = steps(check, "smoke").find((step) => step.startsWith("uses: actions/checkout"));
    expect(checkout).toContain("ref: main");
    expect(checkout).toContain("persist-credentials: false");
  });

  it("uses no npm cache, which a run here would fill for main", () => {
    expect(check).not.toContain("cache: npm");
  });

  it("hands the secrets only to the steps that need them, not to the install", () => {
    expect(check).not.toMatch(/\n  [a-z-]+:\n(?:    [^\n]*\n)*?    env:\n(?:      [^\n]*\n)*?      VERCEL_(TOKEN|AUTOMATION_BYPASS_SECRET):/);
    for (const job of ["smoke", "rollback"]) {
      for (const step of steps(check, job)) {
        const holds = /secrets\./.test(step);
        const needs = /Can the check reach|npm run test:smoke|npm run deploy:rollback/.test(step);
        expect(holds, `${job}: ${step.slice(0, 50)}`).toBe(needs);
      }
    }
  });

  it("rolls back only production, when deploy.yml asks for it and the smoke test ran", () => {
    expect(check).toContain("inputs.rollback == true");
    expect(check).toContain("inputs.environment == 'production'");
    expect(check).toContain("needs.smoke.outputs.reachable == 'true'");
  });
});
