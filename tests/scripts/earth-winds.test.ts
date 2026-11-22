import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { EARTH_LOWS, earthWinds, earthZonalWind } from "../../scripts/earth-winds";
import { FLOW_LIMIT, GH, GW } from "../../scripts/winds";

/**
 * The winds that keep Earth's cloud map moving. These tests check the flow map as the shader reads
 * it: red is the wind towards east and green towards north, mid grey is calm air.
 */

const WIDTH = GW / 2;
const HEIGHT = GH / 2;
const picture = earthWinds();

/** The wind at a place, east and north, in units of the fastest wind along the latitudes. */
function windAt(lonDeg: number, latDeg: number): [number, number] {
  const x = Math.min(WIDTH - 1, Math.max(0, Math.floor(((lonDeg + 180) / 360) * WIDTH)));
  const y = Math.min(HEIGHT - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * HEIGHT)));
  const at = (y * WIDTH + x) * 3;
  return [((picture[at] - 127.5) / 127.5) * FLOW_LIMIT, ((picture[at + 1] - 127.5) / 127.5) * FLOW_LIMIT];
}

describe("earthZonalWind", () => {
  it("blows west in the trade winds and east in the middle latitudes, harder in the south", () => {
    expect(earthZonalWind(0)).toBeLessThan(-0.2);
    expect(earthZonalWind(45)).toBeGreaterThan(0.5);
    expect(earthZonalWind(-47)).toBeCloseTo(1, 1);
    expect(earthZonalWind(-47)).toBeGreaterThan(earthZonalWind(47));
    expect(earthZonalWind(88)).toBeLessThan(0);
  });
});

describe("earthWinds", () => {
  it("is a flow map of the size the shader expects, calm on average towards north", () => {
    expect(picture).toHaveLength(WIDTH * HEIGHT * 3);
    let north = 0;
    for (let i = 1; i < picture.length; i += 3) north += picture[i];
    expect(north / (WIDTH * HEIGHT)).toBeGreaterThan(126);
    expect(north / (WIDTH * HEIGHT)).toBeLessThan(130);
  });

  it("turns the air anticlockwise round a northern low and clockwise round a southern one", () => {
    // East of a low the air moves north in the northern hemisphere and south in the southern one.
    for (const [lon, lat, radius] of EARTH_LOWS) {
      const reach = (radius / 2.2 / Math.max(Math.cos((lat * Math.PI) / 180), 0.35)) * 1.2;
      const east = windAt(lon + reach, lat)[1];
      const west = windAt(lon - reach, lat)[1];
      expect(Math.sign(east), `east of the low at ${lon}, ${lat}`).toBe(Math.sign(lat));
      expect(Math.sign(west), `west of the low at ${lon}, ${lat}`).toBe(-Math.sign(lat));
    }
  });

  it("keeps the usual winds where no low is near", () => {
    // The trade winds of the South Pacific and of the Sahel lie far from every low.
    expect(windAt(-120, -5)[0]).toBeLessThan(-0.2);
    expect(Math.abs(windAt(-120, -5)[1])).toBeLessThan(0.05);
    expect(windAt(10, 8)[0]).toBeLessThan(-0.2);
  });

  it("is the map the app ships", async () => {
    const file = path.resolve("public/textures/planets/earth-clouds-flow.webp");
    expect(existsSync(file)).toBe(true);
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([WIDTH, HEIGHT]);
    expect(Buffer.from(picture).equals(data)).toBe(true);
  });
});
