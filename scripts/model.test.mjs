import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Box3, Matrix4, Ray, Vector3 } from 'three';
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

// Ray tests inspect the shipped mesh, including Boolean cuts, rather than relying
// on source names or metadata that could survive a broken export.
function meshTriangles(name, stationaryOnly = false, materialName) {
  const faces = [];
  function visit(node, rotating = false) {
    rotating ||= !!node.getExtras().rotorAxis;
    if (stationaryOnly && rotating) return;
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (materialName && primitive.getMaterial()?.getName() !== materialName) continue;
      const positions = primitive.getAttribute('POSITION');
      const indices = primitive.getIndices();
      const vertices = Array.from({ length: positions.getCount() }, (_, i) =>
        new Vector3(...positions.getElement(i, [])).applyMatrix4(matrix),
      );
      for (let i = 0; i < indices.getCount(); i += 3)
        faces.push([
          vertices[indices.getScalar(i)],
          vertices[indices.getScalar(i + 1)],
          vertices[indices.getScalar(i + 2)],
        ]);
    }
    node.listChildren().forEach((child) => visit(child, rotating));
  }
  visit(roots.find((n) => n.getName() === name));
  return faces;
}
function blocked(faces, from, to) {
  const distance = from.distanceTo(to);
  const ray = new Ray(from, to.clone().sub(from).normalize());
  const hit = new Vector3();
  return faces.some(
    ([a, b, c]) => ray.intersectTriangle(a, b, c, false, hit) && from.distanceTo(hit) < distance,
  );
}
const boardPoint = ([x, y, z]) => new Vector3(-x, z, y);

test('EPS comb surrounds the actual curved cable bundle instead of floating beside it', () => {
  const faces = meshTriangles('wiringEps', false, 'Woven cable sheath');
  const section = [];
  for (const face of faces)
    for (let edge = 0; edge < 3; edge++) {
      const a = face[edge],
        b = face[(edge + 1) % 3];
      if ((a.x + 1.7) * (b.x + 1.7) < 0) {
        section.push(a.clone().lerp(b, (-1.7 - a.x) / (b.x - a.x)));
      }
    }
  assert.ok(section.length >= 64, 'read cross-section of exported cable sleeves');
  const wireBox = new Box3().setFromPoints(section);
  const combBox = new Box3().setFromPoints(
    worldVertices(
      roots.find((node) => node.getName() === 'wiringEps'),
      'Graphite enamel',
    ),
  );
  assert.ok(
    combBox.getCenter(new Vector3()).distanceTo(wireBox.getCenter(new Vector3())) < 0.012,
    'comb is centered on the eight wires',
  );
  assert.ok(
    combBox.clone().expandByScalar(0.003).containsBox(wireBox),
    'every wire passes inside the comb envelope',
  );
});

test('SSD surface-mounted devices and solder terminations meet the laminate', () => {
  const ssd = roots.find((node) => node.getName() === 'ssd');
  const bodies = worldVertices(ssd, 'Ceramic capacitor body');
  const solder = worldVertices(ssd, 'Brushed aluminium');
  const chips = worldVertices(ssd, 'Moulded silicon packages');
  for (const [x, halfWidth] of [
    [-0.72, 0.201],
    [-0.22, 0.201],
    [0.24, 0.141],
  ]) {
    const topPackage = chips.filter((p) => Math.abs(p.x + x) < halfWidth && p.y > 0.2);
    assert.ok(topPackage.length >= 8);
    const bottom = Math.min(...topPackage.map((p) => p.y));
    assert.ok(bottom >= 0.21 && bottom <= 0.212, `NAND/controller sits on the PCB: ${bottom}`);
  }
  for (const x of [-0.89, -0.61, -0.32, -0.03, 0.24, 0.47]) {
    for (const y of [-1.635, -1.22]) {
      const inFootprint = (p) => Math.abs(p.x + x) < 0.04 && Math.abs(p.z - y) < 0.02;
      for (const [label, vertices] of [
        ['body', bodies],
        ['solder', solder],
      ]) {
        const local = vertices.filter(inFootprint);
        assert.ok(local.length >= 8, `SSD ${label} at ${x},${y}`);
        const bottom = Math.min(...local.map((p) => p.y));
        assert.ok(
          bottom >= 0.21 && bottom <= 0.213,
          `SSD ${label} must touch the 0.211 laminate surface: ${bottom}`,
        );
      }
    }
  }
  const material = root.listMaterials().find((m) => m.getName() === 'NVMe solder mask');
  assert.ok(material?.getBaseColorTexture(), 'SSD has independent circuit artwork');
  assert.notEqual(
    material.getBaseColorTexture(),
    root
      .listMaterials()
      .find((m) => m.getName() === 'Motherboard silkscreen')
      .getBaseColorTexture(),
  );
});

test('fan passages are open behind the blades, with different rotor profiles', () => {
  const counts = root
    .listNodes()
    .filter((n) => n.getExtras().rotorAxis && n.listChildren().length)
    .map((n) => n.getExtras().bladeCount)
    .sort((a, b) => a - b);
  assert.deepEqual(counts, [7, 9, 11, 11, 11]);
  const fans = [
    ['gpu', [-1.52, -1.245, 1.45], 0.84, 'Y'],
    ['gpu', [0.35, -1.245, 1.45], 0.84, 'Y'],
    ['gpu', [2.22, -1.245, 1.45], 0.84, 'Y'],
    ['cooler', [0.5, 1.1, 1.66], 0.67, 'X'],
    ['psu', [-4.22, 0.35, 1.51], 1.05, 'Z'],
  ];
  for (const [name, [x, y, z], radius, axis] of fans) {
    const faces = meshTriangles(name, true);
    let open = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 + 0.12;
      const u = Math.cos(a) * radius * 0.62,
        v = Math.sin(a) * radius * 0.62;
      const point = (depth) => {
        const p =
          axis === 'X'
            ? [x + depth, y + u, z + v]
            : axis === 'Y'
              ? [x + u, y - depth, z + v]
              : [x + u, y + v, z + depth];
        return name === 'psu' ? new Vector3(p[0] - 0.75, p[2], -p[1]) : boardPoint(p);
      };
      if (!blocked(faces, point(0.02), point(-0.073))) open++;
    }
    assert.ok(open >= 10, `${name} fan at ${x}: ${open}/16 unobstructed samples`);
  }
});

test('RAM and PCIe key notches are physically cut out and surrounding contacts remain', () => {
  const gpu = meshTriangles('gpu');
  for (const [x, expected] of [
    [-0.93, false],
    [-1.08, true],
    [-0.78, true],
  ])
    assert.equal(
      blocked(gpu, boardPoint([x, -1.2, 0.22]), boardPoint([x, 0.1, 0.22])),
      expected,
      `PCIe at ${x}`,
    );
  const ram = meshTriangles('ram');
  for (const x of [1.58, 2.04]) {
    for (const [y, expected] of [
      [1.05, false],
      [0.9, true],
      [1.2, true],
    ])
      assert.equal(
        blocked(ram, boardPoint([x - 0.1, y, 0.245]), boardPoint([x + 0.1, y, 0.245])),
        expected,
        `DIMM ${x}, key ${y}`,
      );
  }
});

test('CPU_FAN and SYS_FAN have four pins in a single row', () => {
  const points = worldVertices(
    roots.find((n) => n.getName() === 'board'),
    'Copper contacts',
  ).map((p) => [-p.x, p.z, p.y]);
  for (const [x, y] of [
    [0.72, 2.43],
    [2.22, -2.53],
  ]) {
    const pins = points.filter(
      (p) => Math.abs(p[0] - x) < 0.18 && Math.abs(p[1] - y) < 0.08 && p[2] > 0.16 && p[2] < 0.32,
    );
    assert.ok(pins.length > 16);
    assert.ok(
      Math.max(...pins.map((p) => p[1])) - Math.min(...pins.map((p) => p[1])) < 0.03,
      'one row',
    );
    const positions = pins.map((p) => p[0]).sort((a, b) => a - b);
    assert.equal(
      1 + positions.slice(1).filter((p, i) => p - positions[i] > 0.04).length,
      4,
      'four separate pins',
    );
  }
});

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
    'PCVerse powder coated PSU',
    'NVMe solder mask',
  ]) {
    const material = root.listMaterials().find((m) => m.getName() === name);
    assert.ok(material?.getNormalTexture(), name + ' normal');
    assert.ok(material.getMetallicRoughnessTexture(), name + ' roughness');
    assert.equal(material.getNormalTexture().getMimeType(), 'image/png', 'lossless normal map');
  }
});

test('board contact occlusion and physical-scale microstructure UVs survive export', () => {
  const board = root.listMaterials().find((m) => m.getName() === 'Motherboard silkscreen');
  assert.ok(board.getOcclusionTexture(), 'separate contact occlusion, not painted into albedo');
  assert.match(
    board.getBaseColorTexture().getName(),
    /pcb-laminate-v4/,
    'the detailed etched laminate is shipped, not the sparse replacement',
  );
  assert.notEqual(
    board.getNormalTextureInfo().getTexCoord(),
    board.getBaseColorTextureInfo().getTexCoord(),
    'micrograin has independent UV scale',
  );
  const info = board.getNormalTextureInfo();
  const artworkInfo = board.getBaseColorTextureInfo();
  const artworkTransform = artworkInfo.getExtension('KHR_texture_transform');
  const transform = info.getExtension('KHR_texture_transform');
  assert.ok(transform, 'repeating microstructure retains its sampler transform');
  const offset = transform.getOffset(),
    scale = transform.getScale();
  const surface = root
    .listNodes()
    .find((node) => node.getName() === 'board_Motherboard silkscreen');
  const matrix = new Matrix4().fromArray(surface.getWorldMatrix());
  for (const primitive of surface.getMesh().listPrimitives()) {
    const positions = primitive.getAttribute('POSITION');
    const uv = primitive.getAttribute(`TEXCOORD_${info.getTexCoord()}`);
    const artworkUV = primitive.getAttribute(`TEXCOORD_${artworkInfo.getTexCoord()}`);
    assert.equal(uv.getComponentType(), 5123, 'UVs use compact unsigned shorts');
    for (let i = 0; i < positions.getCount(); i++) {
      const p = new Vector3(...positions.getElement(i, [])).applyMatrix4(matrix);
      const coords = uv.getElement(i, []).map((v, axis) => v * scale[axis] + offset[axis]);
      assert.ok(
        Math.abs(coords[0] + p.x) < 0.004 && Math.abs(coords[1] - (1 - p.z)) < 0.004,
        'compression preserves one microstructure tile per model unit',
      );
      const artwork = artworkUV
        .getElement(i, [])
        .map(
          (v, axis) => v * artworkTransform.getScale()[axis] + artworkTransform.getOffset()[axis],
        );
      assert.ok(
        Math.abs(artwork[0] - (2.44 - p.x) / 4.88) < 0.001 &&
          Math.abs(artwork[1] - (3.05 - p.z) / 6.1) < 0.001,
        'the complete circuit image spans the motherboard once',
      );
    }
  }
});

test('the shipped model is compressed and within realtime budgets', () => {
  assert.ok(root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression'));
  assert.ok(triangles < 235_000, `static geometry: ${triangles}`);
  assert.ok(bytes < 5_300_000, `GLB bytes: ${bytes}`);
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
