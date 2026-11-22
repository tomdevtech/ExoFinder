import { CATALOGUE_CACHE_CONTROL } from "@/shared/cache";
import { toMapSystem } from "../../payload";
import { getMapSystem } from "../../queries";

/** Returns a star and its planets for the system view, or 404 if the star is unknown. */
export async function GET(_request: Request, ctx: RouteContext<"/map/systems/[slug]">) {
  const { slug } = await ctx.params;
  try {
    const system = await getMapSystem(slug);
    if (!system) {
      return Response.json({ error: "There is no star with this address." }, { status: 404 });
    }
    return Response.json(toMapSystem(system.star, system.planets), { headers: { "Cache-Control": CATALOGUE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Loading a system of the map failed:", error);
    return Response.json({ error: "The system is not available right now." }, { status: 503 });
  }
}
