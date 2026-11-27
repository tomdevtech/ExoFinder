import Link from "next/link";
import { formatCount, formatNumber, formatPeriod } from "@/shared/format";
import { moonsOf } from "./bodies";
import { isRetrograde, smallMoonsOf } from "./smallMoons";

interface Row {
  name: string;
  href: string;
  /** Diameter in km, or null if unknown. */
  diameter: number | null;
  estimated: boolean;
  distanceKm: number;
  periodDays: number;
  retrograde: boolean;
  year: number | null;
}

/** Every known moon of a planet or dwarf planet, large and small, from the inside out. */
export function MoonTable({ parent, name }: { parent: string; name: string }) {
  const rows: Row[] = [
    ...moonsOf(parent).map((moon) => ({
      name: moon.name,
      href: `/solar-system/${moon.slug}`,
      diameter: moon.radiusKm * 2,
      estimated: false,
      distanceKm: moon.semiMajorAxisKm,
      periodDays: moon.orbitalPeriodDays,
      retrograde: moon.inclinationDeg > 90,
      year: moon.discoveryYear,
    })),
    ...smallMoonsOf(parent).map((moon) => ({
      name: moon.name,
      href: `/solar-system/${moon.slug}`,
      diameter: moon.radius === null ? null : moon.radius * 2,
      estimated: !moon.measured,
      distanceKm: moon.a,
      periodDays: moon.period,
      retrograde: isRetrograde(moon),
      year: moon.year,
    })),
  ].sort((a, b) => a.distanceKm - b.distanceKm);
  if (rows.length === 0) return null;
  const retrograde = rows.filter((row) => row.retrograde).length;

  return (
    <details className="group flex flex-col gap-3">
      <summary className="cursor-pointer text-sm text-accent underline-offset-4 hover:underline">
        All {formatCount(rows.length)} known moons of {name}
        {retrograde > 0 && `, ${formatCount(retrograde)} of them orbiting backwards`}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-normal">Moon</th>
              <th className="py-2 pr-4 text-right font-normal">Diameter</th>
              <th className="py-2 pr-4 text-right font-normal">Distance</th>
              <th className="py-2 pr-4 text-right font-normal">Orbit</th>
              <th className="py-2 text-right font-normal">Found</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-line">
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  {/* Saturn has almost 300 rows, so no link loads its page before a click. */}
                  <Link className="text-accent underline-offset-4 hover:underline" href={row.href} prefetch={false}>
                    {row.name}
                  </Link>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {row.diameter === null ? "unknown" : `${row.estimated ? "≈ " : ""}${formatNumber(row.diameter)} km`}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {formatCount(Math.round(row.distanceKm))} km
                </td>
                <td className="py-1.5 pr-4 text-right whitespace-nowrap">
                  {formatPeriod(row.periodDays)}
                  {row.retrograde && <span className="text-muted"> · backwards</span>}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">{row.year ?? "antiquity"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        “≈” marks sizes estimated from how bright a moon looks, as most small moons have only been seen as
        points of light. The distance is the mean distance from the centre of {name}. Orbits and discoveries
        from{" "}
        <a className="text-accent underline-offset-4 hover:underline" href="https://ssd.jpl.nasa.gov/sats/">
          JPL Solar System Dynamics
        </a>
        , estimated sizes also from{" "}
        <a className="text-accent underline-offset-4 hover:underline" href="https://sites.google.com/carnegiescience.edu/sheppard/moons">
          Scott Sheppard
        </a>
        .
      </p>
    </details>
  );
}
