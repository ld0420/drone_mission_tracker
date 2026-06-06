import { Router } from 'express';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = join(__dirname, '..', '..', 'public', 'images');

const SLOTS = ['inspection-1.png', 'inspection-2.png', 'inspection-3.png'];

// Cache the three image bodies + their content-hash ETags once.
const cache: Record<string, Buffer> = {};
const etags: Record<string, string> = {};
for (const slot of SLOTS) {
  const buf = readFileSync(join(IMAGE_DIR, slot));
  cache[slot] = buf;
  etags[slot] = `"${createHash('sha1').update(buf).digest('hex').slice(0, 16)}"`;
}

export const mediaRouter = Router();

// GET /api/images/:image_id
// image_id is any string. We rotate which of the 3 sample images is served
// based on a hash of the id — so the same image_id always returns the same
// asset, but different ids spread across the 3 slots. ETag-based caching
// means swapping the underlying files revalidates cleanly without a stale-
// content-type trap.
mediaRouter.get('/images/:image_id', (req, res) => {
  const id = req.params.image_id!;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0x7fffffff;
  const slot = SLOTS[h % SLOTS.length]!;
  const etag = etags[slot]!;
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.setHeader('Content-Type', 'image/png');
  res.send(cache[slot]);
});
