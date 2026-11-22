import { BufferAttribute, BufferGeometry } from "three";
import type { ShapeMesh } from "./shape";

/**
 * The surface of a shape model as three.js draws it. It is kept apart from shape.ts so that three.js
 * only loads where a shape is drawn.
 */
export function shapeGeometry(surface: ShapeMesh): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(surface.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(surface.normals, 3));
  geometry.setAttribute("direction", new BufferAttribute(surface.directions, 3));
  geometry.setIndex(new BufferAttribute(surface.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
