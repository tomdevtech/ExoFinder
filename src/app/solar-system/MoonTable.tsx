import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { bodyName, moonsOf } from "./bodies";
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
export async function MoonTable({ parent, name }: { parent: string; name: string }) {
  const m = await getMessages();
  const { moonTable: text, fmt } = m;
  const rows: Row[] = [
    ...moonsOf(parent).map((moon) => ({
      name: bodyName(moon, m),
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
  const [beforeJpl, beforeSheppard, afterSheppard] = text.note(name);

  return (
    <details className="group flex flex-col gap-3">
      <summary className="cursor-pointer text-sm text-accent underline-offset-4 hover:underline">
        {text.summary(fmt.count(rows.length), name, retrograde > 0 ? fmt.count(retrograde) : null)}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-normal">{text.moon}</th>
              <th className="py-2 pr-4 text-right font-normal">{text.diameter}</th>
              <th className="py-2 pr-4 text-right font-normal">{text.distance}</th>
              <th className="py-2 pr-4 text-right font-normal">{text.orbit}</th>
              <th className="py-2 text-right font-normal">{text.found}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.href} className="border-b border-line">
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  {/* Saturn has almost 300 rows, so no link loads its page before a click. */}
                  <Link className="text-accent underline-offset-4 hover:underline" href={row.href} prefetch={false}>
                    {row.name}
                  </Link>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {row.diameter === null ? text.unknown : `${row.estimated ? "≈ " : ""}${fmt.number(row.diameter)} km`}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono tabular-nums whitespace-nowrap">
                  {fmt.count(Math.round(row.distanceKm))} km
                </td>
                <td className="py-1.5 pr-4 text-right whitespace-nowrap">
                  {fmt.period(row.periodDays)}
                  {row.retrograde && <span className="text-muted"> · {text.backwards}</span>}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">{row.year ?? text.antiquity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {beforeJpl}
        <a className="text-accent underline-offset-4 hover:underline" href="https://ssd.jpl.nasa.gov/sats/">
          JPL Solar System Dynamics
        </a>
        {beforeSheppard}
        <a className="text-accent underline-offset-4 hover:underline" href="https://sites.google.com/carnegiescience.edu/sheppard/moons">
          Scott Sheppard
        </a>
        {afterSheppard}
      </p>
    </details>
  );
}
