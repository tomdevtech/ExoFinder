import { getMessages } from "@/i18n/server";

const HEIGHT = 140;
/** Twice this radius must fit between the top edge and the baseline, which is 28 px above the bottom. */
const MAX_RADIUS = 52;
const MIN_RADIUS = 1.5;
const EARTH_COLOR = "#3b76c4";

/** Earth and the planet side by side, drawn to scale. The larger of the two fills the height. */
export async function SizeComparison({
  name,
  radiusEarth,
  color,
}: {
  name: string;
  /** Radius of the planet in Earth radii. */
  radiusEarth: number;
  /** Colour of the planet's disc. */
  color: string;
}) {
  const m = await getMessages();
  const sentence = m.planet.size(name, m.fmt.number(radiusEarth));
  const scale = MAX_RADIUS / Math.max(1, radiusEarth);
  const earth = Math.max(MIN_RADIUS, scale);
  const planet = Math.max(MIN_RADIUS, radiusEarth * scale);
  const baseline = HEIGHT - 28;
  const earthX = 20 + earth;
  const planetX = earthX + earth + 40 + planet;
  // Leave room for the name below a small planet: about 3.2 px per letter on each side.
  const width = planetX + Math.max(planet, name.length * 3.2) + 20;

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={sentence}
        className="h-auto max-w-full"
      >
        <circle cx={earthX} cy={baseline - earth} r={earth} fill={EARTH_COLOR} />
        <circle cx={planetX} cy={baseline - planet} r={planet} fill={color} />
        <g fill="currentColor" fontSize="11" textAnchor="middle" className="text-muted">
          <text x={earthX} y={HEIGHT - 8}>
            {m.planet.earth}
          </text>
          <text x={planetX} y={HEIGHT - 8}>
            {name}
          </text>
        </g>
      </svg>
      <figcaption className="text-sm text-muted">{sentence}</figcaption>
    </figure>
  );
}
