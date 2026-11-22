import { useId } from "react";

/**
 * Colour of a star by its surface temperature in kelvin: cool stars glow
 * orange-red, sun-like stars yellow-white, hot stars blue-white.
 */
function starImageColor(teffK: number | null): string {
  if (teffK === null) return "#ffe9c4";
  if (teffK < 3700) return "#ff8a50";
  if (teffK < 5200) return "#ffc27a";
  if (teffK < 6000) return "#fff0c9";
  if (teffK < 7500) return "#ffffff";
  return "#bcd4ff";
}

/** A glowing disc in the colour of the star. An illustration, not a photograph. */
export function StarImage({
  teffK,
  size = 160,
  className,
}: {
  teffK: number | null;
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const color = starImageColor(teffK);
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor="#fff" />
          <stop offset="38%" stopColor={color} />
          <stop offset="52%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill={`url(#${id}-glow)`} />
    </svg>
  );
}
