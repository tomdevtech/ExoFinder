/**
 * The winds that go with Earth's cloud map (public/textures/planets/earth-clouds-*). The planet shader
 * moves the photograph along them, so its lows turn and its cloud bands travel (mapClouds in
 * src/app/globe/surface.glsl.ts). Nobody recorded the winds of the moment the photograph shows,
 * so they are put together from what the picture and the climate tell: the lows that can be seen in
 * the clouds, each turning the way its hemisphere makes it, and the usual winds along the latitudes.
 */
import { addWhirl, Flow, GH, GW } from "./winds";

/**
 * The lows of the cloud map of Solar System Scope, read off the picture: longitude and latitude of
 * the centre and the radius of the spiral, in degrees.
 */
export const EARTH_LOWS: readonly [lon: number, lat: number, radius: number][] = [
  [-140, 47, 12],
  [-108, 56, 8],
  [-176, 69, 7],
  [-53, 56, 7],
  [-9, 37, 6],
  [0, 74, 8],
  [-33, 62, 6],
  [52, 69, 6],
  [156, 38, 7],
  [131, 46, 7],
  [172, 55, 9],
  [123, 22, 5],
  [-165, -50, 12],
  [-76, -63, 8],
  [-142, -65, 8],
  [-51, -41, 8],
  [-10, -58, 12],
  [-12, -35, 6],
  [38, -55, 9],
  [117, -58, 9],
  [73, -62, 8],
  [177, -47, 7],
  [155, -57, 8],
];

const DEG = Math.PI / 180;

/** The fastest wind along the latitudes in grid cells per run. Only its ratio to the lows matters, because the flow map is stored in units of it. */
const UNIT = 60;

/**
 * How fast the air turns round a low at its fastest, in units of the fastest wind along the latitudes.
 * Faster, the shader would show the sharp clouds of the photograph twice while it fades from one
 * cycle of its motion to the next.
 */
const LOW_SPEED = 1;

/**
 * The usual wind along the latitudes, from about -0.4 to 1, positive towards the east: trade winds
 * near the equator, westerlies in the middle latitudes (stronger in the south, where no land slows
 * them) and weak easterlies round the poles.
 */
export function earthZonalWind(latDeg: number): number {
  const away = Math.abs(latDeg);
  const westerlies = Math.exp(-(((away - 47) / 17) ** 2)) * (latDeg < 0 ? 1 : 0.8);
  return westerlies - 0.4 * Math.exp(-((latDeg / 16) ** 2)) - 0.12 * Math.exp(-(((away - 85) / 12) ** 2));
}

/**
 * A step east covers more degrees of longitude the nearer the pole it is taken. The flow map counts
 * in degrees, so winds are divided by this; the limit keeps them finite at the poles.
 */
const narrowing = (latDeg: number) => Math.max(Math.cos(latDeg * DEG), 0.35);

/** Returns the flow map of Earth's cloud map as a picture (see Flow.picture). */
export function earthWinds(): Uint8Array {
  const psi = new Float32Array(GW * GH);
  const degreesPerCell = 180 / GH;
  for (const [lon, lat, radius] of EARTH_LOWS) {
    // The spiral of a low reaches about twice as far as the whirl is wide.
    const size = radius / 2.2 / degreesPerCell;
    // The air turns fastest one width from the centre, at 0.671 of strength / width (the slope of addWhirl there).
    const strength = (LOW_SPEED * UNIT * size) / 0.671;
    // Lows turn anticlockwise in the north and clockwise in the south. Towards the poles the whirl
    // spans more longitudes, and its winds count for more degrees.
    addWhirl(psi, null, ((lon + 180) / 360) * GW, ((90 - lat) / 180) * GH, size / narrowing(lat), size, (Math.sign(lat) * strength) / narrowing(lat));
  }
  const flow = new Flow();
  flow.add(psi);
  const latOf = (row: number) => 90 - ((row + 0.5) / GH) * 180;
  return flow.picture(UNIT, (row) => (earthZonalWind(latOf(row)) * UNIT) / narrowing(latOf(row)));
}
