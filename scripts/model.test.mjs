import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';

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
      if (primitive.getMaterial()?.getName() !== materialName) continue;
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
    const x = p.x,
      y = -p.z,
      z = p.y;
    // Quantisation moves vertices by well under a thousandth of a unit.
    const collision =
      x > -2.469 && x < 2.469 && y > -3.119 && y < -2.601 && z > -0.069 && z < 0.419;
    assert.ok(!collision, `static sleeve enters front-edge components: ${[x, y, z]}`);
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
  const maxX = Math.max(...fins.map((p) => p.x));
  // Copper base sits 0.415 above the bench, directly on the 0.404 thermal interface.
  assert.ok(minY > 0.41 && minY < 0.42, `copper base meets the heat spreader: ${minY}`);
  assert.ok(maxX < 1.35, `cooler stays left of the DIMM slots: ${maxX}`);
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
