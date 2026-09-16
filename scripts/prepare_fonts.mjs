import { mkdir, writeFile } from 'node:fs/promises';
const destination = new URL('../src/atlas/fonts/', import.meta.url);
await mkdir(destination, { recursive: true });
const response = await fetch(
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..750&family=Space+Grotesk:wght@400..700&display=swap',
);
if (!response.ok) throw new Error('Font CSS request failed');
let css = await response.text();
let index = 0;
for (const url of new Set([...css.matchAll(/url\((https[^)]+)\)/g)].map((match) => match[1]))) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Font download failed');
  const filename = `atlas-${++index}.ttf`;
  await writeFile(new URL(filename, destination), Buffer.from(await response.arrayBuffer()));
  css = css.replaceAll(url, `./${filename}`);
}
await writeFile(new URL('fonts.css', destination), css);
for (const name of ['dmsans', 'spacegrotesk']) {
  const response = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${name}/OFL.txt`,
  );
  if (!response.ok) throw new Error('Font license request failed');
  await writeFile(new URL(`${name}-OFL.txt`, destination), await response.text());
}
console.log(`Saved ${index} local font files and licenses.`);
