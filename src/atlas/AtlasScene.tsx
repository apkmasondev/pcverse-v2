import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  Environment,
  Grid,
  Html,
  Line,
  OrbitControls,
  useGLTF,
  useProgress,
} from '@react-three/drei';
import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  MeshBasicMaterial,
  SRGBColorSpace,
  ShaderMaterial,
  Quaternion,
  Color,
  BufferGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  Vector3,
  TubeGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { parts, steps } from './content';
import { harnessCurve } from './harness';
import type { Mode, PartId, Workload } from './content';
import type { BuildView } from './assembly';
import { THERMAL_RANGE } from './simulation';
import type { HeatMap } from './simulation';

const offsets: Record<string, [number, number, number]> = {
  base: [0, 0, 0],
  board: [0, 0, 0],
  cpu: [0, 0.75, 0],
  cooler: [0, 2.65, 0],
  gpu: [0, 1.4, 0],
  gpuWiring: [0, 1.4, 0],
  ram: [0, 0.85, 0],
  ssd: [0, 0.95, 0],
  psu: [0, 0, 0],
};
const centers: Record<PartId, [number, number, number]> = {
  cpu: [0, 0.36, 1.1],
  gpu: [-0.35, 1.4, -0.9],
  ram: [-1.81, 0.65, 1.25],
  board: [0, 0.25, 0],
  ssd: [0.2, 0.2, -1.43],
  psu: [-4.97, 0.72, -0.35],
  cooler: [-0.1, 1.6, 1.1],
};
const partIds = new Set<string>(parts.map((p) => p.id));
const HOT = new Color('#ff6a2b');
const MODEL_URL = import.meta.env.BASE_URL + 'models/atlas.glb';
const ENV_URL = import.meta.env.BASE_URL + 'environments/studio_small_03_1k.hdr';

export interface SceneInsets {
  left: number;
  right: number;
}
interface Props {
  isolated: boolean;
  selected: PartId | null;
  hovered: PartId | null;
  onSelect: (id: PartId) => void;
  onHover: (id: PartId | null) => void;
  spread: number;
  mode: Mode;
  step: number;
  running: boolean;
  reduced: boolean;
  reset: number;
  low: boolean;
  insets: SceneInsets;
  onError: () => void;
  onStats: (value: string) => void;
  onProgress: (value: number) => void;
  onReady: () => void;
  airflow: number;
  temperature: number;
  workload: Workload;
  onSlow: () => void;
  /** No user input for a while: ambient fan animation spins down so the GPU can rest. */
  idle: boolean;
  /** The canvas is scrolled out of view: nothing needs to be drawn. */
  onscreen: boolean;
  /** Lab thermal camera; null shows the normal materials. */
  heat: HeatMap | null;
  /** Assembly channel progress; null in every other channel. */
  build: BuildView | null;
}

const ALWAYS_ON_BENCH = new Set(['base', 'board', 'psu']);
/** Which exported root is visible while the machine is being assembled. */
function builtRootVisible(name: string, build: BuildView) {
  if (ALWAYS_ON_BENCH.has(name)) return true;
  if (name === 'wiringAtx') return build.power.atx;
  if (name === 'wiringEps') return build.power.eps;
  if (name === 'wiringPcie' || name === 'gpuWiring') return build.power.pcie;
  if (name === 'wiringFan') return build.power.fan;
  return build.installed.includes(name as PartId) || build.pending === name;
}

/** True while something in the scene animates on its own and needs a continuous frame loop. */
function isAnimating({
  reduced,
  low,
  mode,
  running,
  selected,
  isolated,
  airflow,
  idle,
  build,
}: Props) {
  const visibleFans =
    !isolated || selected === 'gpu' || selected === 'psu' || selected === 'cooler';
  return (
    !reduced &&
    ((!low && !idle && visibleFans && airflow > 0) ||
      mode === 'signal' ||
      (!!build?.pending && !idle) ||
      running ||
      (selected === 'cooler' && airflow > 0))
  );
}

function partOf(object: Object3D | null): PartId | null {
  let node = object;
  while (node && !partIds.has(node.name)) node = node.parent;
  return node ? (node.name as PartId) : null;
}

function Model(props: Props) {
  const {
    selected,
    hovered,
    onSelect,
    onHover,
    spread,
    reduced,
    onStats,
    mode,
    isolated,
    onReady,
    build,
    heat,
  } = props;
  const { scene } = useGLTF(MODEL_URL, false, true);
  const moving = useRef(true);
  const { invalidate } = useThree();
  // Each root gets its own material copies, so one part can glow without lighting up
  // every other part that shares the same surface.
  const { model, materials } = useMemo(() => {
    const clone = scene.clone(true);
    const byPart = new Map<string, MeshStandardMaterial[]>();
    clone.children.forEach((root) => {
      const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>();
      root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const swap = (m: MeshStandardMaterial) => {
          if (!copies.has(m)) {
            const copy = m.clone();
            for (const map of [copy.map, copy.normalMap, copy.roughnessMap]) {
              if (map) map.anisotropy = 8;
            }
            if (copy.name === 'Motherboard silkscreen') {
              copy.color.setRGB(0.7, 0.8, 0.74);
              copy.metalness = 0;
              copy.roughness = 1;
              copy.normalScale.set(0.25, 0.25);
              copy.envMapIntensity = 0.3;
            }
            if (copy.name === 'Moulded silicon packages') {
              copy.color.multiplyScalar(0.35);
              copy.envMapIntensity = 0.45;
            }
            // The white exhibition plinth reads as a glaring slab on the dark bench.
            if (root.name === 'base' && (copy.name === 'Ceramic' || copy.name === 'Porcelain')) {
              copy.color.set(copy.name === 'Ceramic' ? '#0a0d0c' : '#101412');
              copy.roughness = 0.78;
              copy.metalness = 0;
              copy.envMapIntensity = 0.35;
            }
            copies.set(m, copy);
          }
          return copies.get(m)!;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => (m instanceof MeshStandardMaterial ? swap(m) : m))
          : o.material instanceof MeshStandardMaterial
            ? swap(o.material)
            : o.material;
      });
      byPart.set(root.name, [...copies.values()]);
    });
    return { model: clone, materials: byPart };
  }, [scene]);
  useEffect(() => () => materials.forEach((list) => list.forEach((m) => m.dispose())), [materials]);

  // Thermal camera: every exported root gets one false-colour material driven by the lab model.
  const thermal = useMemo(() => {
    const byRoot = new Map<string, ShaderMaterial>();
    const originals = new Map<Mesh, Mesh['material']>();
    model.children.forEach((root) => {
      byRoot.set(root.name, thermalMaterial());
      root.traverse((o) => {
        if (o instanceof Mesh) originals.set(o, o.material);
      });
    });
    return { byRoot, originals };
  }, [model]);
  useEffect(() => () => thermal.byRoot.forEach((material) => material.dispose()), [thermal]);
  useEffect(() => {
    thermal.originals.forEach((original, mesh) => {
      let root: Object3D = mesh;
      while (root.parent && root.parent !== model) root = root.parent;
      mesh.material = heat ? thermal.byRoot.get(root.name)! : original;
    });
    if (heat)
      model.children.forEach((root) => {
        const material = thermal.byRoot.get(root.name)!;
        const part = heat[THERMAL_PART[root.name] ?? 'cables'];
        const bounds = new Box3().setFromObject(root);
        material.uniforms.uLow.value = part.low;
        material.uniforms.uHigh.value = part.high;
        material.uniforms.uYMin.value = bounds.min.y;
        material.uniforms.uYMax.value = Math.max(bounds.max.y, bounds.min.y + 0.01);
      });
    moving.current = true;
    invalidate();
  }, [heat, thermal, model, invalidate]);
  useEffect(() => {
    onReady();
  }, [onReady]);
  const rotors = useMemo(() => {
    const found: { node: Object3D; part: string; axis: 'x' | 'y' | 'z' }[] = [];
    model.traverse((node) => {
      if (node.userData.rotorAxis && node.children.length > 0)
        found.push({ node, part: node.parent!.name, axis: node.userData.rotorAxis });
    });
    return found;
  }, [model]);
  const fanSpeed = useRef(0);
  const stats = useRef({ stamp: 0, frames: 0, text: '' });

  useEffect(() => {
    model.children.forEach((o) => {
      o.visible = build ? builtRootVisible(o.name, build) : !isolated || o.name === selected;
    });
    moving.current = true;
    invalidate();
  }, [spread, selected, isolated, model, invalidate, props.low, build]);

  useEffect(() => {
    materials.forEach((list, id) => {
      const glow = build
        ? id === build.pending && hovered === id
          ? 0.03
          : 0
        : mode !== 'anatomy' || isolated
          ? 0
          : hovered === id
            ? 0.085
            : selected === id
              ? 0.03
              : 0;
      list.forEach((m) => {
        m.emissive.copy(HOT);
        m.emissiveIntensity = glow;
      });
    });
    invalidate();
  }, [materials, hovered, selected, mode, isolated, invalidate, build]);

  useFrame(({ gl, clock }, delta) => {
    stats.current.frames++;
    let settling = false;
    const alpha = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 7);
    // A part waiting to be mounted hovers above its socket; mounted parts sit in place.
    const hover = build?.pending && !reduced ? Math.sin(clock.elapsedTime * 2.2) * 0.06 : 0;
    model.children.forEach((o) => {
      const offset = offsets[o.name];
      if (!offset) return;
      const waiting =
        !!build &&
        (o.name === build.pending || (o.name === 'gpuWiring' && build.pending === 'gpu'));
      const amount = build ? (waiting ? 1.15 : 0) : spread;
      const tx = offset[0] * amount,
        ty = offset[1] * amount + (waiting ? hover : 0),
        tz = offset[2] * amount;
      o.position.set(
        MathUtils.lerp(o.position.x, tx, alpha),
        MathUtils.lerp(o.position.y, ty, alpha),
        MathUtils.lerp(o.position.z, tz, alpha),
      );
      if (
        Math.abs(o.position.y - ty) > 0.001 ||
        Math.abs(o.position.x - tx) > 0.001 ||
        Math.abs(o.position.z - tz) > 0.001
      )
        settling = true;
    });
    // The waiting part bobs gently; it needs continuous frames but no colour tint.
    if (build?.pending && !reduced && !props.idle) invalidate();
    if (settling || moving.current) {
      // Shadow maps are cached (see onCreated) and refreshed only while geometry moves.
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }
    moving.current = settling;
    // Deliberately slowed rotation stays readable and avoids strobing at low FPS.
    const powered =
      !reduced &&
      (props.running || (!props.low && !props.idle)) &&
      props.airflow > 0 &&
      rotors.some(({ part }) => !isolated || selected === part);
    const load = mode === 'lab' && props.running ? (props.workload === 'render' ? 1 : 0.8) : 0.22;
    const desiredSpeed = powered ? ((2 + load * 8) * props.airflow) / 100 : 0;
    fanSpeed.current = reduced
      ? 0
      : MathUtils.damp(fanSpeed.current, desiredSpeed, 3, Math.min(delta, 0.05));
    rotors.forEach(({ node, part, axis }) => {
      if (!isolated || selected === part)
        node.rotation[axis] +=
          Math.min(delta, 0.05) * fanSpeed.current * (part === 'psu' ? 0.65 : 1);
    });
    if (powered || fanSpeed.current > 0.01) invalidate();
    const elapsed = clock.elapsedTime - stats.current.stamp;
    if (elapsed > 1) {
      const fps = Math.round(stats.current.frames / elapsed);
      stats.current.stamp = clock.elapsedTime;
      stats.current.frames = 0;
      const text = `${gl.info.render.calls} DRAW · ${(gl.info.render.triangles / 1000).toFixed(0)}K TRI · DPR ${gl.getPixelRatio().toFixed(1)}${isAnimating(props) ? ` · ${fps} FPS` : ' · NA ŻĄDANIE'}`;
      if (text !== stats.current.text) {
        stats.current.text = text;
        onStats(text);
      }
    }
  });
  const interactive = mode === 'anatomy' || !!build?.pending;
  const target = (object: Object3D) => {
    const id = partOf(object);
    return build && id !== build.pending ? null : id;
  };
  return (
    <primitive
      object={model}
      dispose={null}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (event.delta > 4 || !interactive) return;
        const id = target(event.object);
        if (id) {
          event.stopPropagation();
          onSelect(id);
        }
      }}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        if (!interactive || event.pointerType === 'touch') return;
        event.stopPropagation();
        const id = target(event.object);
        if (id !== hovered) onHover(id);
      }}
      onPointerOut={(event: ThreeEvent<PointerEvent>) => {
        if (!interactive || event.pointerType === 'touch') return;
        // A matching pointerover follows when the pointer moves onto another mesh.
        if (event.intersections.length === 0) onHover(null);
      }}
    />
  );
}

/** Flexible harnesses track the same eased displacement as the exported assemblies.
 * Their PSU/board ends stay fixed; extra slack clears the board and GPU shroud. */
function FlexibleHarness({ spread, reduced, isolated, low, build, heat }: Props) {
  const { invalidate } = useThree();
  const current = useRef(0);
  const dirty = useRef(true);
  const harness = useMemo(() => {
    const group = new Group();
    const material = new MeshStandardMaterial({
      color: '#161b1e',
      roughness: 0.88,
      metalness: 0.02,
    });
    // GPU power cables and the CPU fan lead are separate meshes so they can be connected one by one.
    for (let i = 0; i < 2; i++) {
      const mesh = new Mesh(new BufferGeometry(), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return { group, material };
  }, []);
  const rebuild = (amount: number) => {
    [
      [0, 16],
      [16, 20],
    ].forEach(([from, to], slot) => {
      const geometries: TubeGeometry[] = [];
      for (let index = from; index < to; index++) {
        const curve = harnessCurve(index, amount);
        geometries.push(
          new TubeGeometry(curve, low ? 28 : 48, index < 16 ? 0.021 : 0.009, low ? 5 : 6, false),
        );
      }
      const mesh = harness.group.children[slot] as Mesh;
      mesh.geometry.dispose();
      mesh.geometry = mergeGeometries(geometries)!;
      geometries.forEach((geometry) => geometry.dispose());
    });
  };
  const rebuildRef = useRef(rebuild);
  useLayoutEffect(() => {
    rebuildRef.current = rebuild;
  });
  useEffect(() => {
    rebuildRef.current(current.current);
    dirty.current = true;
    invalidate();
  }, [low, isolated, build, invalidate]);
  useEffect(() => {
    invalidate();
  }, [spread, reduced, invalidate]);
  useEffect(() => {
    harness.group.children.forEach((mesh, slot) => {
      mesh.visible = !build || (slot === 0 ? build.power.pcie : build.power.fan);
    });
    dirty.current = true;
    invalidate();
  }, [harness, build, invalidate]);
  useEffect(
    () => () => {
      harness.group.children.forEach((o) => (o as Mesh).geometry.dispose());
      harness.material.dispose();
    },
    [harness],
  );
  useFrame(({ gl }, delta) => {
    if (dirty.current) {
      dirty.current = false;
      gl.shadowMap.needsUpdate = true;
    }
    const next = reduced
      ? spread
      : MathUtils.damp(current.current, spread, 7, Math.min(delta, 0.05));
    if (Math.abs(next - current.current) > 0.0001) {
      current.current = next;
      rebuildRef.current(next);
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }
  });
  const cableHeat = useMemo(() => thermalMaterial(), []);
  useEffect(() => () => cableHeat.dispose(), [cableHeat]);
  useEffect(() => {
    if (heat) setThermalRange(cableHeat, heat.cables.low, heat.cables.high);
    harness.group.children.forEach((mesh) => {
      (mesh as Mesh).material = heat ? cableHeat : harness.material;
    });
    invalidate();
  }, [heat, cableHeat, harness, invalidate]);
  return <primitive object={harness.group} visible={!isolated} dispose={null} />;
}

const THERMAL_PART: Record<string, keyof HeatMap> = {
  base: 'bench',
  board: 'board',
  cpu: 'cpu',
  cooler: 'cooler',
  gpu: 'gpu',
  ram: 'ram',
  ssd: 'ssd',
  psu: 'psu',
};

function setThermalRange(material: ShaderMaterial, low: number, high: number) {
  material.uniforms.uLow.value = low;
  material.uniforms.uHigh.value = high;
}

/** False-colour "ironbow" palette used by thermal cameras, with simple shading to keep form. */
function thermalMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uLow: { value: THERMAL_RANGE.min },
      uHigh: { value: THERMAL_RANGE.min },
      uYMin: { value: 0 },
      uYMax: { value: 1 },
      uRange: { value: [THERMAL_RANGE.min, THERMAL_RANGE.max] },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLow;
      uniform float uHigh;
      uniform float uYMin;
      uniform float uYMax;
      uniform vec2 uRange;
      varying vec3 vWorld;
      varying vec3 vNormal;
      vec3 ironbow(float t) {
        vec3 c0 = vec3(0.03, 0.0, 0.12);
        vec3 c1 = vec3(0.32, 0.02, 0.55);
        vec3 c2 = vec3(0.78, 0.08, 0.42);
        vec3 c3 = vec3(0.98, 0.38, 0.05);
        vec3 c4 = vec3(1.0, 0.8, 0.18);
        vec3 c5 = vec3(1.0, 0.98, 0.85);
        float s = clamp(t, 0.0, 1.0) * 5.0;
        if (s < 1.0) return mix(c0, c1, s);
        if (s < 2.0) return mix(c1, c2, s - 1.0);
        if (s < 3.0) return mix(c2, c3, s - 2.0);
        if (s < 4.0) return mix(c3, c4, s - 3.0);
        return mix(c4, c5, s - 4.0);
      }
      void main() {
        float height = smoothstep(uYMin, uYMax, vWorld.y);
        float temperature = mix(uLow, uHigh, height);
        vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float shade = 0.7 + 0.3 * abs(dot(n, normalize(vec3(0.35, 1.0, -0.45))));
        gl_FragColor = vec4(ironbow((temperature - uRange.x) / (uRange.y - uRange.x)) * shade, 1.0);
      }`,
    side: DoubleSide,
  });
}

// Q-LED diagnostic column near the front edge by SYS_FAN, where the GPU does not hide it,
// plus a standby light and the RJ45 link lights. Positions are in scene space.
const QLEDS = [
  { id: 'cpu', label: 'CPU', color: '#ff3b2f' },
  { id: 'dram', label: 'DRAM', color: '#ffc21a' },
  { id: 'vga', label: 'VGA', color: '#f4f7ff' },
  { id: 'boot', label: 'BOOT', color: '#3dff6e' },
  { id: 'stby', label: 'STBY', color: '#3dff6e' },
] as const;
const QLED_X = -2.3;
const qledZ = (i: number) => -1.8 - i * 0.135;
type LedState = 'off' | 'on' | 'blink';

function silkscreenLabel(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#c9cfca';
  context.font = '600 44px ui-monospace, Consolas, monospace';
  context.textBaseline = 'middle';
  context.fillText(text, 8, 34);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/** Motherboard status lights: the Q-LED column tells the POST story, RJ45 lights show activity. */
function DiagnosticLeds({ build, mode, running, reduced, isolated, selected, idle, heat }: Props) {
  const { invalidate } = useThree();
  const bootStarted = useRef<number | null>(null);
  const resources = useMemo(() => {
    const glow = glowTexture();
    return {
      labels: QLEDS.map((led) => silkscreenLabel(led.label)),
      glow,
      lamps: [...QLEDS.map((led) => led.color), '#3dff6e', '#ffb020'].map(
        (color) =>
          new MeshStandardMaterial({
            color: '#161a18',
            emissive: new Color(color),
            emissiveIntensity: 0,
            roughness: 0.35,
            toneMapped: false,
          }),
      ),
      halos: [...QLEDS.map((led) => led.color), '#3dff6e', '#ffb020'].map(
        (color) =>
          new MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            map: glow,
            blending: AdditiveBlending,
            toneMapped: false,
          }),
      ),
    };
  }, []);
  useEffect(
    () => () => {
      resources.labels.forEach((t) => t.dispose());
      resources.glow.dispose();
      [...resources.lamps, ...resources.halos].forEach((m) => m.dispose());
    },
    [resources],
  );

  const post = build?.post ?? 'none';
  const powered = !build || build.power.atx;
  const q: Record<(typeof QLEDS)[number]['id'], LedState> = {
    cpu: post === 'eps' ? 'on' : 'off',
    dram: 'off',
    vga: post === 'pcie' ? 'on' : 'off',
    boot: 'off',
    stby: powered ? 'on' : 'off',
  };
  const systemUp = !build || post === 'ok' || post === 'paste' || post === 'fan';
  const link: LedState = systemUp ? 'on' : 'off';
  const activity: LedState =
    !build && (running || mode === 'signal')
      ? 'blink'
      : build && (post === 'ok' || post === 'paste')
        ? 'blink'
        : 'off';
  const booting = post === 'booting' && !!build?.power.atx;
  const states: LedState[] = [q.cpu, q.dram, q.vga, q.boot, q.stby, link, activity];
  const animated = !reduced && !idle && (booting || activity === 'blink');

  useEffect(() => {
    bootStarted.current = booting ? null : bootStarted.current;
    invalidate();
  }, [booting, post, invalidate]);

  useFrame(({ clock }) => {
    if (booting && bootStarted.current === null) bootStarted.current = clock.elapsedTime;
    const step = booting ? Math.floor((clock.elapsedTime - (bootStarted.current ?? 0)) / 0.33) : -1;
    states.forEach((state, i) => {
      let lit =
        state === 'on' ||
        (state === 'blink' && (reduced || Math.sin(clock.elapsedTime * 18 + i) > 0.2));
      if (booting && i < 4) lit = reduced ? i === 3 : Math.min(step, 3) === i;
      const hidden = !!heat;
      resources.lamps[i].emissiveIntensity = lit && !hidden ? 2.4 : 0;
      resources.halos[i].opacity = lit && !hidden ? (i < 5 ? 0.85 : 0.6) : 0;
    });
    if (animated) invalidate();
  });

  if (isolated && selected !== 'board') return null;
  const fault = post === 'eps' ? 'CPU' : post === 'pcie' ? 'VGA' : null;
  return (
    <group>
      {QLEDS.map((led, i) => {
        const z = qledZ(i);
        return (
          <group key={led.id}>
            <mesh position={[QLED_X, 0.09, z]} material={resources.lamps[i]}>
              <boxGeometry args={[0.1, 0.04, 0.06]} />
            </mesh>
            <mesh
              position={[QLED_X, 0.12, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={resources.halos[i]}
            >
              <planeGeometry args={[0.32, 0.32]} />
            </mesh>
            <mesh position={[QLED_X + 0.17, 0.071, z]} rotation={[-Math.PI / 2, 0, Math.PI]}>
              <planeGeometry args={[0.2, 0.05]} />
              <meshBasicMaterial
                map={resources.labels[i]}
                transparent
                toneMapped={false}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
      {[1.72, 2.1].map((z, i) => (
        <group key={z}>
          <mesh position={[2.47, 0.66, z]} material={resources.lamps[5 + i]}>
            <boxGeometry args={[0.014, 0.03, 0.06]} />
          </mesh>
          <mesh
            position={[2.49, 0.66, z]}
            rotation={[0, Math.PI / 2, 0]}
            material={resources.halos[5 + i]}
          >
            <planeGeometry args={[0.2, 0.2]} />
          </mesh>
        </group>
      ))}
      {fault && (
        <Html position={[QLED_X, 0.5, qledZ(1)]} center zIndexRange={[5, 0]}>
          <span className="airflow-tag hot">● Q-LED {fault}</span>
        </Html>
      )}
    </group>
  );
}

function position(id: PartId, spread: number) {
  const part = parts.find((p) => p.id === id)!;
  const offset = offsets[id];
  return new Vector3(...part.position).add(new Vector3(...offset).multiplyScalar(spread));
}

function Flow({ spread, step, reduced, running, mode, workload }: Props) {
  const particles = useRef<Group>(null);
  const current =
    steps[mode === 'lab' ? (workload === 'game' ? 2 : workload === 'render' ? 1 : 0) : step];
  const power = mode === 'signal' && step === 3;
  const path = useMemo(() => {
    const start = position(current.from, spread),
      end = position(current.to, spread);
    return [
      start,
      new Vector3(start.x, start.y + 0.6, start.z),
      new Vector3(end.x, end.y + 0.6, end.z),
      end,
    ];
  }, [current, spread]);
  useFrame(({ clock, invalidate }) => {
    if (!particles.current || reduced || !(mode === 'signal' || running)) return;
    particles.current.children.forEach((p, i) => {
      const t = ((clock.elapsedTime * 0.4 + i / 6) % 1) * 3,
        index = Math.min(2, Math.floor(t));
      p.position.lerpVectors(path[index], path[index + 1], t - index);
    });
    invalidate();
  });
  if (mode !== 'signal' && !running) return null;
  const tone = power ? '#ffc14d' : '#ff6a2b';
  return (
    <group>
      <Line points={path} color={tone} lineWidth={2} dashed dashSize={0.1} gapSize={0.07} />
      {power && (
        <Line
          points={[position('cpu', spread), position('cooler', spread)]}
          color="#5fd4c4"
          lineWidth={4}
        />
      )}
      {!reduced && (
        <group ref={particles}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshBasicMaterial color={tone} toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

// Tower cooler geometry in scene units (see scripts/build_atlas.py): the 120 mm fan sits on
// the -X face, the fin stack spans x ±0.37 and the airflow leaves towards the rear I/O (+X).
const TOWER = { fanX: -0.61, finsX: 0.37, fanY: 1.66, z: 1.1, top: 2.5 };
const INTAKE = new Color('#5fd4c4');
const WARM = new Color('#ffc14d');
const HOT_AIR = new Color('#ff4d3d');
const STREAMS: [number, number][] = [
  [0, 0],
  [0.36, -0.3],
  [0.36, 0.3],
  [-0.36, -0.3],
  [-0.36, 0.3],
];

/** Streamlines drawn as a diagram over the model: cool air converges on the fan, crosses
 * the fins and leaves warmer towards the rear panel. Dashes move with the fan speed. */
function Airflow({ spread, airflow, temperature, reduced, running, mode, selected }: Props) {
  const streams = useRef<Group>(null);
  const active = (mode === 'lab' && running) || (mode === 'anatomy' && selected === 'cooler');
  const lift = offsets.cooler[1] * spread;
  const heat = MathUtils.clamp(((mode === 'lab' ? temperature : 55) - 25) / 65, 0, 1);
  const exhaust = useMemo(
    () =>
      INTAKE.clone()
        .lerp(WARM, Math.min(1, heat * 1.7))
        .lerp(HOT_AIR, Math.max(0, (heat - 0.6) / 0.4)),
    [heat],
  );
  const lines = useMemo(
    () =>
      STREAMS.map(([dy, dz]) => {
        const y = TOWER.fanY + lift + dy,
          z = TOWER.z + dz;
        const curve = new CatmullRomCurve3([
          new Vector3(-2.1, y + dy * 0.7, z + dz * 0.9),
          new Vector3(-1.2, y + dy * 0.25, z + dz * 0.3),
          new Vector3(TOWER.fanX, y, z),
          new Vector3(0, y, z),
          new Vector3(TOWER.finsX + 0.05, y, z),
          new Vector3(1.2, y + 0.08 + dy * 0.2, z + dz * 0.4),
          // Warm air drifts slightly upwards as it leaves the fins.
          new Vector3(2.1, y + 0.22 + dy * 0.45, z + dz * 0.9),
        ]);
        const points = curve.getPoints(48);
        const colors = points.map((point) => {
          const t = MathUtils.smoothstep(point.x, TOWER.fanX, TOWER.finsX + 0.35);
          return INTAKE.clone().lerp(exhaust, t);
        });
        const end = points[points.length - 1];
        const tangent = curve.getTangent(1);
        const heading = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tangent);
        return { points, colors, end, heading };
      }),
    [lift, exhaust],
  );
  useFrame(({ invalidate }, delta) => {
    if (!active || reduced || !streams.current || airflow === 0) return;
    streams.current.children.forEach((line) => {
      const material = (line as Mesh).material as unknown as { dashOffset: number };
      material.dashOffset -= Math.min(delta, 0.05) * (0.25 + airflow * 0.014);
    });
    invalidate();
  });
  if (!active) return null;
  const hot = temperature >= 90 && mode === 'lab';
  const still = airflow === 0;
  return (
    <group>
      <group ref={streams}>
        {lines.map(({ points, colors }, i) => (
          <Line
            key={i}
            points={points}
            vertexColors={colors}
            lineWidth={i === 0 ? 3 : 2}
            dashed
            dashSize={0.16}
            gapSize={0.1}
            transparent
            opacity={still ? 0.28 : i === 0 ? 0.95 : 0.7}
            depthTest={false}
          />
        ))}
      </group>
      {lines.map(({ end, heading }, i) => (
        <mesh key={i} position={end} quaternion={heading} renderOrder={10}>
          <coneGeometry args={[i === 0 ? 0.07 : 0.05, i === 0 ? 0.2 : 0.15, 12]} />
          <meshBasicMaterial
            color={exhaust}
            toneMapped={false}
            transparent
            opacity={still ? 0.3 : 0.95}
            depthTest={false}
          />
        </mesh>
      ))}
      <Html position={[-2.15, TOWER.top + lift + 0.05, TOWER.z]} center zIndexRange={[4, 0]}>
        <span className="airflow-tag">
          {still ? 'WENTYLATOR STOI' : mode === 'lab' ? `WLOT · ${airflow}%` : 'WLOT · CHŁODNE'}
        </span>
      </Html>
      <Html position={[2.15, TOWER.top + lift + 0.3, TOWER.z]} center zIndexRange={[4, 0]}>
        <span className={`airflow-tag exhaust ${hot ? 'hot' : ''}`}>
          {mode === 'lab'
            ? `WYLOT · ~${Math.round(24 + (temperature - 24) * 0.35)}°C`
            : 'WYLOT · CIEPŁE'}
        </span>
      </Html>
    </group>
  );
}

/** Watches continuous animation only; sparse on-demand frames during a slow drag are not a slow GPU. */
function PerformanceGuard({
  onSlow,
  low,
  active,
}: {
  onSlow: () => void;
  low: boolean;
  active: boolean;
}) {
  const samples = useRef({ time: 0, frames: 0 });
  useEffect(() => {
    samples.current = { time: 0, frames: 0 };
  }, [active, low]);
  useFrame((_, delta) => {
    if (low || !active || delta > 0.5 || delta < 0.001) return;
    samples.current.time += delta;
    samples.current.frames++;
    if (samples.current.frames >= 120) {
      if (samples.current.frames / samples.current.time < 28) onSlow();
      samples.current = { time: 0, frames: 0 };
    }
  });
  return null;
}

function Labels({
  selected,
  hovered,
  onSelect,
  onHover,
  spread,
  mode,
  step,
  isolated,
  build,
}: Props) {
  if (isolated) return null;
  const shown: PartId[] =
    mode === 'signal'
      ? step === 3
        ? ['psu', 'board', 'cpu', 'cooler']
        : [steps[step].from, steps[step].to]
      : build
        ? build.pending
          ? [build.pending]
          : []
        : mode === 'lab'
          ? []
          : [
              ...(selected ? [selected] : (['psu', 'gpu', 'cooler'] as const)),
              ...(hovered ? [hovered] : []),
            ];
  return (
    <>
      {parts
        .filter((p) => shown.includes(p.id))
        .map((p) => (
          <Html
            key={p.id}
            position={position(p.id, spread).add(new Vector3(0, 0.15, 0))}
            center
            zIndexRange={[5, 0]}
          >
            <button
              className={`part-pin ${selected === p.id ? 'active' : ''} ${hovered === p.id ? 'hover' : ''}`}
              onClick={() => onSelect(p.id)}
              onPointerEnter={() => (mode === 'anatomy' || !!build) && onHover(p.id)}
              onPointerLeave={() => (mode === 'anatomy' || !!build) && onHover(null)}
              aria-label={`Poznaj: ${p.name}`}
              disabled={mode !== 'anatomy' && p.id !== build?.pending}
              tabIndex={-1}
            >
              <span>{p.ref}</span>
              {p.label}
            </button>
          </Html>
        ))}
    </>
  );
}

/** Camera offset from the orbit target that fits the exhibit (or one part) in the visible area. */
function framing(
  focusPart: PartId | null,
  size: { width: number; height: number },
  insets: SceneInsets,
) {
  const visible = Math.max(240, size.width - insets.left - insets.right);
  const aspect = visible / Math.max(1, size.height);
  if (!focusPart)
    return new Vector3(10.5, 10.3, -14).multiplyScalar(MathUtils.clamp(1.2 / aspect, 0.92, 1.4));
  const scale =
    focusPart === 'gpu' || focusPart === 'board'
      ? 1.15
      : focusPart === 'psu'
        ? 0.95
        : focusPart === 'cpu' || focusPart === 'ssd'
          ? 0.4
          : 0.65;
  // The tower's fan now faces -X, so its close-up orbits in from that side.
  return new Vector3(
    focusPart === 'cooler' ? -5 : 5,
    4,
    focusPart === 'psu' ? 7 : -7,
  ).multiplyScalar(scale * MathUtils.clamp(1 / aspect, 1, 1.75));
}

function CameraRig({
  reset,
  onError,
  isolated,
  selected,
  spread,
  insets,
  reduced,
  mode,
  view,
}: Pick<
  Props,
  'reset' | 'onError' | 'isolated' | 'selected' | 'spread' | 'insets' | 'reduced' | 'mode'
> & {
  view: string;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const focusPart = isolated ? selected : null;
  // Assembly happens on the board, so that channel frames the bench a little closer.
  const building = mode === 'build';
  const closeness = building && !focusPart ? 0.8 : 1;
  const focusSpread = isolated ? spread : 0;
  const target = useMemo(
    () =>
      focusPart
        ? new Vector3(...centers[focusPart]).add(
            new Vector3(...offsets[focusPart]).multiplyScalar(focusSpread),
          )
        : building
          ? new Vector3(-0.9, 0.8, 0)
          : new Vector3(-1.05, 1.1, 0),
    [focusPart, focusSpread, building],
  );
  const frame = useRef({ size, insets });
  useLayoutEffect(() => {
    frame.current = { size, insets };
  });

  // Shift the projection centre so the exhibit sits in the visible gap between the side panels
  // instead of hiding behind them. Resizing only re-frames; it never throws away the user's orbit.
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const shift = Math.round((insets.left - insets.right) / 2);
    if (shift)
      perspective.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height);
    else perspective.clearViewOffset();
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, insets.left, insets.right, invalidate]);
  useEffect(() => () => (camera as PerspectiveCamera).clearViewOffset(), [camera]);

  useEffect(() => {
    const offset = framing(focusPart, frame.current.size, frame.current.insets).multiplyScalar(
      closeness,
    );
    if (focusPart && view !== 'orbit') {
      const distance = offset.length() * (view === 'top' || view === 'bottom' ? 1.2 : 1);
      offset
        .copy(
          view === 'top'
            ? new Vector3(0, 1, 0.001)
            : view === 'bottom'
              ? new Vector3(0, -1, 0.001)
              : view === 'back'
                ? focusPart === 'psu'
                  ? // ATX rear wall: IEC inlet, switch and exhaust face away from the board.
                    new Vector3(-1, 0.15, 0.12)
                  : new Vector3(0.15, 0.15, 1)
                : view === 'ports'
                  ? focusPart === 'psu'
                    ? new Vector3(1, 0.18, 0.12)
                    : new Vector3(1, 0.18, -0.04)
                  : new Vector3(0, 0.12, focusPart === 'psu' ? 1 : -1),
        )
        .normalize()
        .multiplyScalar(distance);
    }
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    invalidate();
  }, [reset, camera, invalidate, focusPart, target, view, closeness]);

  // When a side panel appears or changes width, keep the user's viewing angle and only adjust
  // the distance, so the exhibit still fits the space left between the panels.
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current) {
      fitted.current = true;
      return;
    }
    const distance =
      framing(focusPart, frame.current.size, {
        left: insets.left,
        right: insets.right,
      }).length() * closeness;
    const direction = camera.position.clone().sub(target).normalize();
    camera.position.copy(target).add(direction.multiplyScalar(distance));
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only panel changes should re-fit
  }, [insets.left, insets.right]);

  useEffect(() => {
    const handle = (event: Event) => {
      event.preventDefault();
      onError();
    };
    gl.domElement.addEventListener('webglcontextlost', handle);
    return () => gl.domElement.removeEventListener('webglcontextlost', handle);
  }, [gl, onError]);
  return (
    <OrbitControls
      key={`${reset}-${isolated}-${isolated ? selected : ''}-${view}`}
      target={target}
      makeDefault
      enablePan={false}
      minDistance={isolated ? 0.8 : 4}
      maxDistance={28}
      minPolarAngle={isolated ? 0.001 : 0.18}
      maxPolarAngle={isolated ? Math.PI - 0.001 : Math.PI / 2.1}
      enableDamping={!reduced}
      dampingFactor={0.09}
    />
  );
}

/** Returning on screen after `frameloop="never"` needs one explicit frame. */
function Wake({ onscreen }: { onscreen: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (onscreen) invalidate();
  }, [onscreen, invalidate]);
  return null;
}

function LoadProgress({ onProgress }: { onProgress: (value: number) => void }) {
  const { progress } = useProgress();
  useEffect(() => {
    onProgress(progress);
  }, [progress, onProgress]);
  return null;
}

export default function AtlasScene(props: Props) {
  const [inspection, setInspection] = useState({ part: props.selected, view: 'orbit' });
  const view = inspection.part === props.selected ? inspection.view : 'orbit';
  return (
    <>
      {props.isolated && (
        <div className="inspection-views" aria-label="Ujęcie części">
          {(
            [
              ['orbit', 'Perspektywa'],
              ['front', 'Przód'],
              ['back', 'Tył'],
              ['top', 'Góra'],
              ['bottom', 'Spód'],
              ['ports', 'Złącza'],
            ] as const
          )
            .filter(
              ([id]) => id !== 'ports' || ['board', 'gpu', 'psu'].includes(props.selected ?? ''),
            )
            .map(([id, label]) => (
              <button
                key={id}
                aria-pressed={view === id}
                onClick={() => setInspection({ part: props.selected, view: id })}
              >
                {label}
              </button>
            ))}
        </div>
      )}
      <LoadProgress onProgress={props.onProgress} />
      <Canvas
        shadows={{ enabled: !props.low, type: PCFShadowMap }}
        dpr={props.low ? 1 : [1, 1.5]}
        frameloop={props.onscreen ? 'demand' : 'never'}
        camera={{ position: [10, 11, -14], fov: 37, near: 0.1, far: 90 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0b0d0c', 0);
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
        onPointerMissed={() => props.hovered && props.onHover(null)}
      >
        <ambientLight intensity={props.isolated ? 0.26 : 0.14} />
        <directionalLight
          position={[4, 10, -5]}
          intensity={props.isolated ? 2.1 : 2.2}
          color={props.isolated ? '#ffffff' : '#fff5eb'}
          castShadow={!props.low}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-normalBias={0.012}
          shadow-radius={2}
          shadow-bias={-0.00015}
        />
        <directionalLight
          position={[-7, 5, 6]}
          intensity={props.isolated ? 1.2 : 1.0}
          color={props.isolated ? '#e8f0ff' : '#b3d4cf'}
        />
        <directionalLight position={[8, 2, -4]} intensity={0.45} color="#ffe2c8" />
        <directionalLight position={[0, 1, -9]} intensity={1.1} color="#e6eef5" />
        {props.isolated && (
          <directionalLight position={[0, -5, 2]} intensity={1.4} color="#f1f4ff" />
        )}
        <Suspense fallback={null}>
          <Environment files={ENV_URL} environmentIntensity={props.isolated ? 0.16 : 0.14} />
          <Model {...props} />
          <FlexibleHarness {...props} />
          <DiagnosticLeds {...props} />
          <Flow {...props} />
          {props.build?.paste && (
            <mesh position={[0, 0.408, 1.1]}>
              <cylinderGeometry args={[0.2, 0.22, 0.008, 40]} />
              <meshStandardMaterial color="#9aa19e" roughness={0.5} metalness={0.25} />
            </mesh>
          )}
          <Labels {...props} />
          {(!props.isolated || props.selected === 'cooler') && <Airflow {...props} />}
          {!props.isolated &&
            props.mode === 'anatomy' &&
            props.spread > 0.1 &&
            (['gpu', 'ram', 'cpu', 'cooler', 'ssd'] as const).map((id) => (
              <Line
                key={id}
                points={[position(id, 0), position(id, props.spread)]}
                color="#7c8a83"
                transparent
                opacity={0.45}
                dashed
                dashSize={0.07}
                gapSize={0.07}
                lineWidth={1}
              />
            ))}
        </Suspense>
        <mesh
          visible={!props.isolated}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.67, 0]}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.5} />
        </mesh>
        {!props.isolated && (
          <Grid
            position={[0, -0.68, 0]}
            args={[40, 40]}
            cellSize={0.5}
            cellThickness={0.6}
            cellColor="#1f2724"
            sectionSize={2.5}
            sectionThickness={1}
            sectionColor="#34413b"
            fadeDistance={34}
            fadeStrength={1.6}
            infiniteGrid
          />
        )}
        <Wake onscreen={props.onscreen} />
        <CameraRig {...props} view={view} />
        <PerformanceGuard onSlow={props.onSlow} low={props.low} active={isAnimating(props)} />
      </Canvas>
    </>
  );
}

useGLTF.preload(MODEL_URL, false, true);
