// Compresses the Blender export for the web: deduplicated resources, welded vertices and
// EXT_meshopt_compression (quantised attributes). The decoder ships inside three-stdlib,
// so loading the model never contacts a CDN.
// Usage: node scripts/optimize_model.mjs [input=art/export/atlas.raw.glb] [output=public/models/atlas.glb]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
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
await document.transform(
  dedup(),
  // Empty rotor pivots and part roots carry the extras the scene relies on.
  prune({ keepLeaves: true, keepExtras: true }),
  weld(),
  meshopt({ encoder: MeshoptEncoder, level: 'high', quantizeNormal: 8, quantizeTexcoord: 12 }),
);
await io.write(output, document);

const mib = (path) => (statSync(path).size / 1048576).toFixed(2);
console.log(`Model optimised: ${input} ${mib(input)} MiB → ${output} ${mib(output)} MiB`);
