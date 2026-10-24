// Gera os ícones PNG do PWA a partir de public/icon.svg.
import sharp from 'sharp';
const src = new URL('../public/icon.svg', import.meta.url);
const out = (f) => new URL(`../public/${f}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const svg = await (await import('node:fs/promises')).readFile(src);
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(file));
}
console.log('ok');
