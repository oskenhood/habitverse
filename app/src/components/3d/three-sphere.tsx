'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 3D-сфера на «чистом» three.js, который подгружается с CDN **по требованию**.
 *
 * Почему не @react-three/fiber + drei в бандле:
 *   эти три пакета добавляют в сборку ~1.5 МБ исходников, из-за чего `next build`
 *   на машинах с <2 ГБ RAM падает (build worker получает SIGKILL), а на Vercel
 *   растут время и память билда. Проверено фактически: без них сборка проходит за ~30 с.
 *
 * Решение: по умолчанию рисуем лёгкую CSS 3D-сферу, а полноценный WebGL пользователь
 * включает переключателем — тогда three.js докачивается с CDN и в сборку не попадает.
 *
 * Типов three.js здесь нет намеренно: пакет не является зависимостью проекта.
 * Описаны только те поверхности API, которые реально используются.
 */

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.min.js';

interface V3 { set(x: number, y: number, z: number): void }
interface Obj3D {
  position: V3;
  rotation: V3;
  scale: V3;
  add(o: unknown): void;
}
interface CameraLike extends Obj3D { aspect: number; updateProjectionMatrix(): void }
interface RendererLike {
  domElement: HTMLCanvasElement;
  setPixelRatio(n: number): void;
  setSize(w: number, h: number): void;
  render(scene: unknown, camera: unknown): void;
  dispose(): void;
}
interface ThreeNS {
  Scene: new () => Obj3D & { add(o: unknown): void };
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => CameraLike;
  WebGLRenderer: new (opts: { antialias: boolean; alpha: boolean }) => RendererLike;
  AmbientLight: new (color: number, intensity: number) => unknown;
  PointLight: new (color: number, intensity: number) => Obj3D & { intensity: number };
  Group: new () => Obj3D;
  Mesh: new (geometry: unknown, material: unknown) => Obj3D & { material: { emissiveIntensity?: number } };
  SphereGeometry: new (r: number, ws: number, hs: number) => unknown;
  TorusGeometry: new (r: number, tube: number, rs: number, ts: number) => unknown;
  MeshStandardMaterial: new (o: Record<string, unknown>) => unknown;
  MeshBasicMaterial: new (o: Record<string, unknown>) => unknown;
  Color: new (c: string) => unknown;
  Clock: new () => { getElapsedTime(): number };
}

let threePromise: Promise<ThreeNS | null> | null = null;

function loadThree(): Promise<ThreeNS | null> {
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const w = window as unknown as { THREE?: ThreeNS };
    if (w.THREE) return resolve(w.THREE);

    const script = document.createElement('script');
    script.src = THREE_CDN;
    script.async = true;
    script.onload = () => resolve((window as unknown as { THREE?: ThreeNS }).THREE ?? null);
    script.onerror = () => {
      threePromise = null;
      resolve(null);
    };
    document.head.appendChild(script);
    return undefined;
  });
  return threePromise;
}

export function ThreeJsSphere({ pct, colors }: { pct: number; colors: string[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const colorsKey = colors.join(',');

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let renderer: RendererLike | null = null;
    let offResize: (() => void) | null = null;

    void (async () => {
      const THREE = await loadThree();
      if (disposed) return;
      if (!THREE || !host.current) {
        if (!THREE) setFailed(true);
        return;
      }

      const el = host.current;
      const w = el.clientWidth || 210;
      const h = el.clientHeight || 210;
      const palette = colorsKey ? colorsKey.split(',') : ['#7c5cff'];

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
      camera.position.set(0, 0.6, 5.2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const l1 = new THREE.PointLight(0xffffff, 26);
      l1.position.set(4, 4, 4);
      scene.add(l1);
      const l2 = new THREE.PointLight(0x00e5c3, 14);
      l2.position.set(-4, -2, -3);
      scene.add(l2);

      const group = new THREE.Group();
      scene.add(group);

      // ядро: размер и свечение растут вместе с процентом выполнения за сегодня
      const k = Math.max(0.15, Math.min(1, pct / 100));
      const baseScale = 0.6 + k * 0.44;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 48),
        new THREE.MeshStandardMaterial({
          color: 0x7c5cff,
          emissive: 0x7c5cff,
          emissiveIntensity: 0.5 + k * 2.4,
          roughness: 0.25,
          metalness: 0.35,
        }),
      );
      core.scale.set(baseScale, baseScale, baseScale);
      group.add(core);

      const ringColors = [0x7c5cff, 0x00e5c3, 0xff5c8a];
      const rings = [1.55, 1.82, 2.08].map((radius, i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.014 - i * 0.002, 12, 120),
          new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.7 - i * 0.15 }),
        );
        group.add(ring);
        return ring;
      });

      const sparks = palette.slice(0, 16).map((c, i, arr) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 12, 12),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(c) }),
        );
        group.add(mesh);
        return {
          mesh,
          radius: 1.5 + (i % 4) * 0.22,
          speed: 0.24 + (i % 5) * 0.06,
          phase: (i / arr.length) * Math.PI * 2,
          tilt: (i % 3) * 0.5 + 0.2,
        };
      });

      const clock = new THREE.Clock();
      const tick = () => {
        if (disposed || !renderer) return;
        const t = clock.getElapsedTime();
        const s = baseScale * (1 + Math.sin(t * 2) * 0.035);
        core.scale.set(s, s, s);
        rings[0].rotation.set(t * 0.32, t * 0.18, 0);
        rings[1].rotation.set(0, -t * 0.26, t * 0.2);
        rings[2].rotation.set(-t * 0.15, 0, t * 0.22);
        group.rotation.set(0, t * 0.12, 0);
        sparks.forEach((sp) => {
          const a = t * sp.speed + sp.phase;
          sp.mesh.position.set(Math.cos(a) * sp.radius, Math.sin(a * 0.7) * sp.tilt * 0.6, Math.sin(a) * sp.radius);
        });
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      const onResize = () => {
        if (!host.current || !renderer) return;
        const nw = host.current.clientWidth || 210;
        const nh = host.current.clientHeight || 210;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', onResize);
      offResize = () => window.removeEventListener('resize', onResize);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      offResize?.();
      if (host.current) host.current.innerHTML = '';
      renderer?.dispose();
      renderer = null;
    };
  }, [pct, colorsKey]);

  if (failed) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden />;
}
