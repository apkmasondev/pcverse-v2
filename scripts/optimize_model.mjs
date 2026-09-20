// Compresses the Blender export for the web: deduplicated resources, welded vertices and
// EXT_meshopt_compression (quantised attributes). The decoder ships inside three-stdlib,
// so loading the model never contacts a CDN.
// Usage: node scripts/optimize_model.mjs [input=art/export/atlas.raw.glb] [output=public/models/atlas.glb]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureTransform } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [input = 'art/export/atlas.raw.glb', output = 'public/models/atlas.glb'] =
  process.argv.slice(2);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const document = await io.read(input);
// Physical-scale UVs repeat outside [0, 1]. Store a normalized grid and restore
// the original coordinates in the sampler, allowing 16-bit meshopt compression.
// Keep the artwork and grain channels separate, including their repeat scale.
const uvAccessors = new Set(
  document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) =>
      mesh.listPrimitives().flatMap((primitive) =>
        primitive
          .listSemantics()
          .filter((semantic) => semantic.startsWith('TEXCOORD_'))
          .map((semantic) => primitive.getAttribute(semantic)),
      ),
    ),
);
const low = [0, 0],
  high = [1, 1];
for (const accessor of uvAccessors) {
  const min = accessor.getMin([]),
    max = accessor.getMax([]);
  for (let axis = 0; axis < 2; axis++) {
    low[axis] = Math.min(low[axis], Math.floor(min[axis]));
    high[axis] = Math.max(high[axis], Math.ceil(max[axis]));
  }
}
const scale = high.map((value, axis) => value - low[axis]);
const textureTransform = document.createExtension(KHRTextureTransform);
for (const material of document.getRoot().listMaterials()) {
  for (const slot of ['BaseColor', 'MetallicRoughness', 'Normal', 'Occlusion', 'Emissive']) {
    const info = material[`get${slot}TextureInfo`]();
    if (!info) continue;
    if (info.getExtension('KHR_texture_transform')) {
      throw new Error('Normalize source texture transforms in Blender before compressing UVs.');
    }
    info.setExtension(
      'KHR_texture_transform',
      textureTransform.createTransform().setOffset(low).setScale(scale),
    );
  }
}
for (const accessor of uvAccessors) {
  const values = accessor.getArray();
  for (let i = 0; i < values.length; i++) {
    values[i] = (values[i] - low[i % 2]) / scale[i % 2];
  }
}
await document.transform(
  dedup(),
  // Empty rotor pivots and part roots carry the extras the scene relies on.
  prune({ keepLeaves: true, keepExtras: true }),
  weld(),
  meshopt({ encoder: MeshoptEncoder, level: 'high', quantizeNormal: 8, quantizeTexcoord: 16 }),
);
await io.write(output, document);

const mib = (path) => (statSync(path).size / 1048576).toFixed(2);
console.log(`Model optimised: ${input} ${mib(input)} MiB → ${output} ${mib(output)} MiB`);
