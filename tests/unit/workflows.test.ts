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

  it("builds production without the domain of the site, so nobody sees it before the smoke test", () => {
    const upload = steps(deploy, "deploy").find((step) => step.startsWith("name: Deploy to Vercel"));
    expect(upload).toContain("set -- --prod --skip-domain");
    expect(upload).not.toMatch(/set -- --prod\n/);
  });

  it("puts a deployment live only when it is production and its smoke test has passed", () => {
    const start = deploy.indexOf("\n  promote:\n");
    const head = deploy.slice(start, deploy.indexOf("    steps:", start));
    expect(head).toContain("needs: [deploy, check]");
    expect(head).toContain("if: ${{ needs.deploy.outputs.environment == 'production' }}");
    // A status function such as always() would let the job run although the smoke test failed.
    expect(head).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
    const live = steps(deploy, "promote").find((step) => step.startsWith("name: Put the checked deployment live"));
    // The API puts live the deployment that was checked, found by the address the smoke test used.
    expect(live).toContain("/v13/deployments/$host");
    expect(live).toContain("/v10/projects/$VERCEL_PROJECT_ID/promote/$id");
  });

  it("goes live through the API, not through a command that needs to know the token's user", () => {
    expect(deploy).not.toMatch(/vercel@[\d.]+ promote/);
  });

  it("reads the ids of the project from secrets, which stay out of the public log", () => {
    expect(deploy.match(/VERCEL_ORG_ID: \$\{\{ secrets\.VERCEL_ORG_ID \|\| vars\.VERCEL_ORG_ID \}\}/g)).toHaveLength(2);
    expect(deploy.match(/VERCEL_PROJECT_ID: \$\{\{ secrets\.VERCEL_PROJECT_ID \|\| vars\.VERCEL_PROJECT_ID \}\}/g)).toHaveLength(2);
    expect(deploy).not.toMatch(/: \$\{\{ vars\.VERCEL_/);
  });

  it("hands the token only to the two steps that talk to Vercel", () => {
    for (const job of ["deploy", "promote", "held-back"]) {
      for (const step of steps(deploy, job)) {
        const needs = /^name: (Deploy to Vercel|Put the checked deployment live)/.test(step);
        expect(/secrets\./.test(step), `${job}: ${step.slice(0, 50)}`).toBe(needs);
      }
    }
  });
});

describe("catalogue.yml", () => {
  const catalogue = read("catalogue.yml");
  const all = steps(catalogue, "catalogue");

  it("keeps the token that may write the release away from the code of the repository", () => {
    const checkout = all.find((step) => step.startsWith("uses: actions/checkout"));
    expect(checkout).toContain("persist-credentials: false");
    for (const step of all) {
      const holds = step.includes("github.token");
      expect(holds, step.slice(0, 50)).toBe(step.startsWith("name: Publish"));
    }
    // The step that holds the token runs gh alone, not a script of the repository.
    expect(all.find((step) => step.startsWith("name: Publish"))).not.toMatch(/npm |npx |node /);
  });

  it("hands the database only to the step that builds the catalogue", () => {
    for (const step of all) {
      expect(/secrets\./.test(step), step.slice(0, 50)).toBe(step.startsWith("name: Build the catalogue"));
    }
  });

  it("publishes the file the site links to", async () => {
    const { CATALOGUE } = await import("@/app/catalog/editions");
    expect(catalogue).toContain(`gh release upload catalogue --clobber .cache/catalogue/${CATALOGUE.file}`);
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
    for (const step of steps(check, "smoke")) {
      const holds = /secrets\./.test(step);
      const needs = /Can the check reach|npm run test:smoke/.test(step);
      expect(holds, step.slice(0, 50)).toBe(needs);
    }
  });

  it("only looks at a deployment: it holds no token that could change what is live", () => {
    expect(check).not.toContain("VERCEL_TOKEN");
    expect(check).not.toMatch(/vercel (promote|rollback|deploy)|deploy:rollback/);
  });
});
