import { useId } from "react";
import type { Appearance, Layer } from "./appearance";
import { Globe } from "@/app/globe/Globe";
import { globeRadius } from "@/app/globe/spec";

const SIZE = 200;
const CENTER = SIZE / 2;

/**
 * Noise values cluster around 0.5, so a threshold above 0.5 makes a layer cover less of the surface.
 * The factor was tuned by eye.
 */
function threshold(coverage: number): number {
  return 0.5 + (0.5 - coverage) * 0.42;
}

/** Turns noise into an alpha mask with a short ramp at the threshold, so the edges stay soft. */
function maskMatrix(layer: Layer): string {
  const steepness = 14;
  const offset = -steepness * threshold(layer.coverage);
  return `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${steepness} 0 0 0 ${offset}`;
}

/**
 * The image of a planet, computed from its appearance. It is an illustration derived from measured values,
 * not a photograph.
 *
 * The server renders a still SVG, and in the browser a lit, rotating globe fades in on top (globe/Globe.tsx).
 * In the still image each layer is a flat colour that shows only where a noise pattern exceeds a threshold:
 * round noise gives patches, stretched noise gives bands, and a shadow on top makes the disc look like a sphere.
 */
export function PlanetImage({
  appearance,
  size = 160,
  label,
  className,
  animated = true,
}: {
  appearance: Appearance;
  /** Width and height in CSS pixels. */
  size?: number;
  /** Accessible name for screen readers. Leave it out when the name is shown next to the image. */
  label?: string;
  className?: string;
  /** Pass false where something else draws the animated planet on top. */
  animated?: boolean;
}) {
  // Ids must be unique per image because several images can share one page.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { base, layers, banded, atmosphere, starTint, rings, seed } = appearance;
  // Ringed planets are drawn smaller so the rings fit. A planet with a moon matches the size of its
  // animated globe, which has to leave room for the moon.
  const radius = rings ? 50 : 100 * globeRadius(appearance.globe);
  const frequency = banded ? "0.003 0.055" : "0.016";

  const still = (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      className={animated ? "block" : className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={`${id}-disc`}>
          <circle cx={CENTER} cy={CENTER} r={radius} />
        </clipPath>

        {layers.map((layer, index) => (
          <filter
            key={index}
            id={`${id}-layer-${index}`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={frequency}
              numOctaves={banded ? 3 : 5}
              seed={seed + index * 17}
            />
            <feColorMatrix type="matrix" values={maskMatrix(layer)} result="mask" />
            <feComposite in="SourceGraphic" in2="mask" operator="in" />
          </filter>
        ))}

        {/* Light comes from the upper left, so the lower right lies in shadow. */}
        <radialGradient id={`${id}-shadow`} cx="34%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="45%" stopColor="#000" stopOpacity="0.08" />
          <stop offset="78%" stopColor="#000" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.94" />
        </radialGradient>

        <radialGradient id={`${id}-highlight`} cx="32%" cy="28%" r="45%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {atmosphere && (
          <>
            <radialGradient id={`${id}-glow`}>
              <stop offset="84%" stopColor={atmosphere} stopOpacity="0.5" />
              <stop offset="100%" stopColor={atmosphere} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-rim`}>
              <stop offset="80%" stopColor={atmosphere} stopOpacity="0" />
              <stop offset="100%" stopColor={atmosphere} stopOpacity="0.55" />
            </radialGradient>
          </>
        )}

        {rings && (
          <>
            <clipPath id={`${id}-ring-back`}>
              <rect x="0" y="0" width={SIZE} height={CENTER} />
            </clipPath>
            <clipPath id={`${id}-ring-front`}>
              <rect x="0" y={CENTER} width={SIZE} height={CENTER} />
            </clipPath>
          </>
        )}
      </defs>

      <g transform={rings ? `rotate(-16 ${CENTER} ${CENTER})` : undefined}>
        {rings && <Rings clip={`${id}-ring-back`} />}

        {atmosphere && (
          <circle cx={CENTER} cy={CENTER} r={radius * 1.16} fill={`url(#${id}-glow)`} />
        )}

        <g clipPath={`url(#${id}-disc)`}>
          <rect width={SIZE} height={SIZE} fill={base} />
          {layers.map((layer, index) => (
            <rect
              key={index}
              width={SIZE}
              height={SIZE}
              fill={layer.color}
              opacity={layer.opacity}
              filter={`url(#${id}-layer-${index})`}
            />
          ))}
          {starTint && (
            <rect
              width={SIZE}
              height={SIZE}
              fill={starTint}
              opacity="0.22"
              className="mix-blend-multiply"
            />
          )}
          {atmosphere && (
            <circle cx={CENTER} cy={CENTER} r={radius} fill={`url(#${id}-rim)`} />
          )}
          <circle cx={CENTER} cy={CENTER} r={radius} fill={`url(#${id}-highlight)`} />
          <circle cx={CENTER} cy={CENTER} r={radius} fill={`url(#${id}-shadow)`} />
        </g>

        {rings && <Rings clip={`${id}-ring-front`} />}
      </g>
    </svg>
  );

  if (!animated) return still;
  return (
    <Globe spec={JSON.stringify(appearance.globe)} className={className}>
      {still}
    </Globe>
  );
}

/** One half of the ring system: the back half lies behind the planet, the front half in front. */
function Rings({ clip }: { clip: string }) {
  return (
    <g clipPath={`url(#${clip})`} fill="none">
      <ellipse cx={CENTER} cy={CENTER} rx="72" ry="17" stroke="#c9b48a" strokeWidth="7" opacity="0.55" />
      <ellipse cx={CENTER} cy={CENTER} rx="84" ry="20" stroke="#e3d3ad" strokeWidth="9" opacity="0.8" />
      <ellipse cx={CENTER} cy={CENTER} rx="93" ry="22.5" stroke="#b9a57e" strokeWidth="3" opacity="0.5" />
    </g>
  );
}
