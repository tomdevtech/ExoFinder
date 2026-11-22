/**
 * Audit policy for the development tools, checked in CI by scripts/audit-tools.ts.
 *
 * Production dependencies must have no known vulnerability: CI runs `npm audit --omit=dev` without exceptions.
 * Dev-only tools (test runner, bundler, linter) may have moderate advisories, but none rated high or critical.
 * When an advisory has no fixed version yet, it can be accepted here by id with a reason and an expiry date.
 * After that date CI fails again, so the exception is reviewed instead of staying forever.
 */

/** An advisory that is accepted until a given date. */
export interface AuditException {
  /** The id of the advisory, as in https://github.com/advisories/GHSA-…. */
  id: string;
  package: string;
  /** The last day the exception holds, as YYYY-MM-DD. */
  until: string;
  /** Why it may wait: what uses the package, and why the flaw cannot reach visitors. */
  why: string;
}

export const AUDIT_EXCEPTIONS: readonly AuditException[] = [];

/** The parts of an `npm audit --json` report (format 2) that are read here. */
export interface AuditReport {
  vulnerabilities: Record<
    string,
    {
      name: string;
      /** The advisories of the package itself, or names of the packages it is vulnerable through. */
      via: (string | { url?: string; title?: string; severity?: string; name?: string })[];
    }
  >;
}

export interface Advisory {
  id: string;
  package: string;
  title: string;
  severity: string;
}

const SERIOUS = new Set(["high", "critical"]);

/** Returns the advisories rated high or critical in a report, without duplicates. */
export function seriousAdvisories(report: AuditReport): Advisory[] {
  const found = new Map<string, Advisory>();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const cause of vulnerability.via) {
      if (typeof cause === "string" || !cause.severity || !SERIOUS.has(cause.severity)) continue;
      const id = cause.url?.split("/").pop() ?? `${cause.name ?? vulnerability.name}: ${cause.title ?? "unknown"}`;
      if (!found.has(id)) {
        found.set(id, { id, package: cause.name ?? vulnerability.name, title: cause.title ?? "", severity: cause.severity });
      }
    }
  }
  return [...found.values()];
}

/** Result of the tool audit: failures fail CI, notes are only printed. */
export interface AuditVerdict {
  failures: string[];
  notes: string[];
}

/**
 * Judges a report. Every high or critical advisory fails CI unless an exception accepts it until `today`
 * or later. An expired exception fails as well, and one whose advisory no longer appears is noted for removal.
 */
export function judgeAudit(report: AuditReport, exceptions: readonly AuditException[], today: string): AuditVerdict {
  const failures: string[] = [];
  const notes: string[] = [];
  const advisories = seriousAdvisories(report);
  for (const advisory of advisories) {
    const exception = exceptions.find((item) => item.id === advisory.id);
    const name = `${advisory.package} (${advisory.severity}): ${advisory.title} https://github.com/advisories/${advisory.id}`;
    if (!exception) {
      failures.push(`${name}. Update the package, or if no fixed version exists yet, see src/deploy/audit.ts.`);
    } else if (exception.until < today) {
      failures.push(`${name}. Its exception ran out on ${exception.until}: is there a fixed version now?`);
    } else {
      notes.push(`Accepted until ${exception.until}: ${name}`);
    }
  }
  for (const exception of exceptions) {
    if (!advisories.some((advisory) => advisory.id === exception.id)) {
      notes.push(`The exception for ${exception.id} (${exception.package}) is no longer needed and can be removed.`);
    }
  }
  return { failures, notes };
}
