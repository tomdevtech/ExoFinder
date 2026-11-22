"use client";

import { useEffect, useRef, useState } from "react";
import { loadShapeGrid, SHAPE_FRAGMENT, SHAPE_VERTEX, shapeMesh } from "@/app/globe/shape";
import { linearColor, SPIN_RATE } from "@/app/globe/spec";
import { MAX_PIXEL_RATIO } from "@/app/globe/view";
import { useViewer, ViewerFrame } from "@/app/globe/ViewerFrame";

/** The radius of the body on screen at zoom 1, in CSS pixels, for the speed of a drag. */
const DRAG_RADIUS = 70;
/** The model starts seen from slightly above, which shows more of an irregular shape. */
const PITCH = 0.25;

/**
 * The interactive 3D model of an irregular body, drawn from its shape model with three.js, which only
 * loads with this component. It works like the planets' model: it turns by itself, drags, zooms with the
 * buttons, two fingers, Ctrl and the wheel, and the keyboard. Light falls from the upper left, as there.
 */
export function ShapeViewer({
  name,
  shapeUrl,
  maxRadius,
  mapUrl,
  color,
}: {
  name: string;
  shapeUrl: string;
  /** The largest radius in radii of the sphere of the same volume. */
  maxRadius: number;
  /** The surface map, or null to draw the body in `color`. */
  mapUrl: string | null;
  color: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useViewer(frame, canvas, { pitch: PITCH, pinchGlides: true, dragRadius: () => DRAG_RADIUS });
  const { start } = viewer;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let stop = () => {};
    let cancelled = false;

    (async () => {
      const [three, { shapeGeometry }] = await Promise.all([import("three"), import("@/app/globe/shapeGeometry")]);
      const grid = await loadShapeGrid(shapeUrl);
      if (cancelled) return;
      let renderer: InstanceType<typeof three.WebGLRenderer>;
      try {
        renderer = new three.WebGLRenderer({ canvas: element, antialias: true, alpha: true });
      } catch {
        setFailed(true);
        return;
      }
      const geometry = shapeGeometry(shapeMesh(grid, maxRadius));
      const blank = new three.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      blank.needsUpdate = true;
      const uniforms = {
        uMapDay: { value: blank as InstanceType<typeof three.Texture> },
        uHasMap: { value: 0 },
        uTint: { value: linearColor(color) },
        uLight: { value: [1, 1, 1] },
        uLightObject: { value: new three.Vector3() },
        uCameraObject: { value: new three.Vector3() },
      };
      const mesh = new three.Mesh(
        geometry,
        new three.RawShaderMaterial({ glslVersion: three.GLSL3, vertexShader: SHAPE_VERTEX, fragmentShader: SHAPE_FRAGMENT, uniforms }),
      );
      const scene = new three.Scene();
      scene.add(mesh);
      const camera = new three.PerspectiveCamera(20, 1, 0.01, 1000);
      // The camera stands far enough back that the body's farthest point fits the picture at zoom 1.
      const fit = (maxRadius * 1.08) / Math.sin((10 * Math.PI) / 180);
      // The star stands to the upper left and slightly in front, as in the planets' model.
      const sunward = new three.Vector3(-0.62, 0.42, 0.66).normalize().multiplyScalar(1000);
      const light = new three.Vector3();

      const mapReady = new Promise<void>((resolve) => {
        if (!mapUrl) return resolve();
        new three.TextureLoader().load(
          mapUrl,
          (texture) => {
            texture.wrapS = three.RepeatWrapping;
            texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
            uniforms.uMapDay.value = texture;
            uniforms.uHasMap.value = 1;
            resolve();
          },
          undefined,
          () => resolve(),
        );
      });
      await mapReady;
      if (cancelled) return;

      // Setting the size clears the canvas and allocates its buffer anew, so it happens only on a change.
      let sized = { ratio: 0, width: 0, height: 0 };
      const stopLoop = start(({ seconds, yaw, pitch, zoom }) => {
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (ratio !== sized.ratio || width !== sized.width || height !== sized.height) {
          sized = { ratio, width, height };
          renderer.setPixelRatio(ratio);
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(height, 1);
          camera.updateProjectionMatrix();
        }
        // The body spins about its axis; dragging turns the camera round it.
        mesh.rotation.set(0, seconds * SPIN_RATE, 0);
        const distance = fit / zoom;
        // A drag to the right brings the body's left side into view, so the camera goes the other way.
        camera.position.set(
          -distance * Math.cos(pitch) * Math.sin(yaw),
          distance * Math.sin(pitch),
          distance * Math.cos(pitch) * Math.cos(yaw),
        );
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        mesh.updateMatrixWorld();
        // The light keeps its place in the view while the camera turns.
        light.copy(sunward).applyQuaternion(camera.quaternion);
        mesh.worldToLocal(uniforms.uLightObject.value.copy(light));
        mesh.worldToLocal(uniforms.uCameraObject.value.copy(camera.position));
        renderer.render(scene, camera);
        return true;
      });
      stop = () => {
        stopLoop();
        geometry.dispose();
        mesh.material.dispose();
        uniforms.uMapDay.value.dispose();
        blank.dispose();
        renderer.dispose();
      };
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, [shapeUrl, maxRadius, mapUrl, color, start]);

  return (
    <ViewerFrame frame={frame} canvas={canvas} viewer={viewer} name={name}>
      <p className="text-center text-sm text-muted">
        {failed ? `This browser cannot draw the 3D model of ${name}.` : `Loading the shape of ${name}…`}
      </p>
    </ViewerFrame>
  );
}
