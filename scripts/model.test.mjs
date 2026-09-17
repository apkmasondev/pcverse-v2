import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Box3, Matrix4, Vector3 } from 'three';
import { harnessCurve } from '../src/atlas/harness.ts';

// Reads the shipped, meshopt-compressed model exactly as the browser receives it.
const path = fileURLToPath(new URL('../public/models/atlas.glb', import.meta.url));
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(path);
const root = document.getRoot();
const roots = root.getDefaultScene().listChildren();
const bytes = statSync(path).size;

function worldVertices(node, materialName) {
  const points = [];
  node.traverse((child) => {
    const mesh = child.getMesh();
    if (!mesh) return;
    const matrix = new Matrix4().fromArray(child.getWorldMatrix());
    for (const primitive of mesh.listPrimitives()) {
      if (materialName && primitive.getMaterial()?.getName() !== materialName) continue;
      const position = primitive.getAttribute('POSITION');
      for (let i = 0; i < position.getCount(); i++)
        points.push(new Vector3(...position.getElement(i, [])).applyMatrix4(matrix));
    }
  });
  return points;
}
const primitives = root.listMeshes().flatMap((mesh) => mesh.listPrimitives());
const triangles = primitives.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);

test('all selectable assemblies and fixed wiring survive export', () => {
  for (const name of [
    'base',
    'board',
    'cpu',
    'cooler',
    'gpu',
    'gpuWiring',
    'ram',
    'ssd',
    'psu',
    'wiringAtx',
    'wiringEps',
    'wiringPcie',
    'wiringFan',
  ]) {
    assert.ok(
      roots.some((n) => n.getName() === name),
      name,
    );
  }
});

test('GPU plugs are a separate assembly with finished latches and strain relief', () => {
  const plugs = roots.find((n) => n.getName() === 'gpuWiring');
  assert.equal(plugs?.getExtras().connector_finish, true);
  assert.ok(plugs.listChildren().length >= 4);
});

test('exported ATX/EPS wires clear the motherboard front edge and USB/front-panel headers', () => {
  const vertices = ['wiringAtx', 'wiringEps'].flatMap((name) =>
    worldVertices(
      roots.find((n) => n.getName() === name),
      'Woven cable sheath',
    ),
  );
  assert.ok(vertices.length > 100, 'read actual exported sleeve geometry');
  for (const p of vertices) {
    const x = -p.x,
      y = p.z,
      z = p.y;
    // Quantisation moves vertices by well under a thousandth of a unit.
    const collision =
      x > -2.469 && x < 2.469 && y > -3.119 && y < -2.601 && z > -0.069 && z < 0.419;
    assert.ok(!collision, `static sleeve enters front-edge components: ${[x, y, z]}`);
    const gpuCollision = x > -2.6 && x < 3.2 && y > -1.37 && y < -0.43 && z > 0.12 && z < 2.6;
    assert.ok(!gpuCollision, `static sleeve enters the GPU: ${[x, y, z]}`);
    const atxOutlet = Math.abs(x - 2.27) < 0.11 && Math.abs(y - 0.65) < 0.5 && z > 0.57;
    const epsOutlet = Math.abs(x + 0.95) < 0.17 && y > 2.69 && z > 0.44;
    const boardCollision = Math.abs(x) < 2.44 && Math.abs(y) < 3.05 && z < 0.68;
    assert.ok(
      !boardCollision || atxOutlet || epsOutlet,
      `static sleeve enters motherboard components: ${[x, y, z]}`,
    );
  }
});

test('flexible cables meet the exported plugs after the layout change', () => {
  const vertices = (name) => worldVertices(roots.find((n) => n.getName() === name));
  const gpu = vertices('gpuWiring');
  const psu = new Box3().setFromPoints(vertices('wiringPcie'));
  const fan = new Box3().setFromPoints(vertices('wiringFan'));
  const near = (point, mesh) => mesh.some((vertex) => vertex.distanceTo(point) < 0.06);
  for (let i = 0; i < 20; i++) {
    const curve = harnessCurve(i, 0);
    assert.ok(
      (i < 16 ? psu : fan).distanceToPoint(curve.getPoint(0)) < 0.025,
      `wire ${i} starts at its fixed plug`,
    );
    if (i < 16) assert.ok(near(curve.getPoint(1), gpu), `wire ${i} ends in its GPU boot`);
  }
});

test('five impellers have independent correctly located pivots', () => {
  const rotors = root.listNodes().filter((n) => n.getExtras().rotorAxis && n.listChildren().length);
  assert.equal(rotors.length, 5);
  assert.equal(rotors.filter((n) => n.getExtras().rotorAxis === 'z').length, 3);
  assert.equal(
    rotors.filter((n) => n.getExtras().rotorAxis === 'x').length,
    1,
    'tower fan faces the fin stack',
  );
  for (const n of rotors) {
    assert.ok(n.listChildren().length >= 2, 'blades and hub remain separate material batches');
    const [, height] = n.getWorldTranslation();
    assert.ok(Number.isFinite(height) && height > 1.4 && height < 1.9);
  }
});

test('tower cooler stack sits on the CPU and clears the first DIMM', () => {
  const cooler = roots.find((n) => n.getName() === 'cooler');
  const copper = worldVertices(cooler, 'Copper contacts');
  const fins = worldVertices(cooler, 'Brushed aluminium');
  const minY = Math.min(...copper.map((p) => p.y));
  const maxX = Math.max(...fins.map((p) => -p.x));
  // Copper base sits 0.415 above the bench, directly on the 0.404 thermal interface.
  assert.ok(minY > 0.41 && minY < 0.42, `copper base meets the heat spreader: ${minY}`);
  assert.ok(maxX < 1.35, `cooler stays left of the DIMM slots: ${maxX}`);
});

test('the board assembly faces outward and the GPU clears the relocated PSU', () => {
  const node = (name) => roots.find((n) => n.getName() === name);
  // Rear I/O was authored on local -X. In world space it must face +X.
  for (const name of ['board', 'cpu', 'cooler', 'gpu', 'gpuWiring', 'ram', 'ssd', 'wiringFan']) {
    const direction = new Vector3(-1, 0, 0).transformDirection(
      new Matrix4().fromArray(node(name).getWorldMatrix()),
    );
    assert.ok(direction.x > 0.999, `${name} shares the board rotation`);
    assert.ok(
      node(name)
        .getTranslation()
        .every((v) => Math.abs(v) < 1e-6),
      'root origin remains usable by disassembly',
    );
  }
  const gpu = worldVertices(node('gpu'));
  const psu = worldVertices(node('psu'));
  const gap = Math.min(...gpu.map((p) => p.x)) - Math.max(...psu.map((p) => p.x));
  assert.ok(gap > 0.35, `GPU/PSU clearance: ${gap}`);
  const tray = worldVertices(node('base'));
  assert.ok(
    Math.min(...tray.map((p) => p.x)) < Math.min(...psu.map((p) => p.x)) - 0.2,
    'PSU stays on the expanded tray',
  );
});

test('manufactured surfaces export usable normal and roughness maps', () => {
  for (const name of [
    'Motherboard silkscreen',
    'Brushed aluminium',
    'Fan satin polymer',
    'Woven cable sheath',
    'GPU machined metal',
  ]) {
    const material = root.listMaterials().find((m) => m.getName() === name);
    assert.ok(material?.getNormalTexture(), name + ' normal');
    assert.ok(material.getMetallicRoughnessTexture(), name + ' roughness');
    assert.equal(material.getNormalTexture().getMimeType(), 'image/png', 'lossless normal map');
  }
});

test('the shipped model is compressed and within realtime budgets', () => {
  assert.ok(root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression'));
  assert.ok(triangles < 215_000, `static geometry: ${triangles}`);
  assert.ok(bytes < 5_000_000, `GLB bytes: ${bytes}`);
  const wireTriangles = root
    .listMeshes()
    .filter((m) => m.getName().includes('sleeved wire'))
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  assert.ok(wireTriangles < 25_000, `wiring geometry: ${wireTriangles}`);
});

console.log(
  `Model: ${Math.round(triangles).toLocaleString('en-US')} triangles, ${root.listMeshes().length} meshes, ${(bytes / 1048576).toFixed(2)} MiB`,
);
