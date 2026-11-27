/**
 * Picks the production deployment to roll back to from `vercel list --environment production --json`.
 * scripts/rollback-production.ts uses it to put the deployment before a broken one back live.
 */

/** A deployment as the Vercel CLI lists it, with only the fields read here. */
interface ListedDeployment {
  url?: unknown;
  uid?: unknown;
  createdAt?: unknown;
  created?: unknown;
  target?: unknown;
  state?: unknown;
  readyState?: unknown;
}

/** Normalises a deployment URL to its host, so "https://exofinder-abc.vercel.app/" and "exofinder-abc.vercel.app" match. */
export function deploymentHost(url: string): string {
  return url.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

function deploymentsOf(output: unknown): ListedDeployment[] {
  if (Array.isArray(output)) return output;
  if (output && typeof output === "object" && Array.isArray((output as { deployments?: unknown }).deployments)) {
    return (output as { deployments: ListedDeployment[] }).deployments;
  }
  throw new Error("The Vercel CLI did not list any deployments.");
}

/**
 * Returns the host of the newest ready production deployment other than the failed one, or null when there is
 * none (for example when the failed one is the first).
 */
export function pickRollbackTarget(output: unknown, failedUrl: string): string | null {
  const failed = deploymentHost(failedUrl);
  const candidates = deploymentsOf(output)
    .filter((d) => typeof d.url === "string" && deploymentHost(d.url) !== failed)
    .filter((d) => d.target === undefined || d.target === "production")
    .filter((d) => {
      const state = d.state ?? d.readyState;
      return state === undefined || state === "READY";
    })
    .map((d) => ({ host: deploymentHost(d.url as string), created: Number(d.createdAt ?? d.created ?? 0) }))
    .sort((a, b) => b.created - a.created);
  return candidates[0]?.host ?? null;
}
