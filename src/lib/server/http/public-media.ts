import type { R2BucketLike } from '../cloudflare-context';

const types: Record<string, string> = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  m4a: 'audio/mp4', mp3: 'audio/mpeg', mp4: 'video/mp4', json: 'application/json',
};
const publicKey = /^(?:posters\/fb-poster-[\w-]+\.webp|videos\/fb-video-[\w-]+\.mp4|audio\/practice\/(?:ambient\/)?[\w-]+\.(?:mp3|m4a)|vegan\/weeks\/v[1-5]\/\d{4}-\d{2}-\d{2}\.json|offline-data\/(?:english-pack-manifest\.json|chapters-en\/[\w-]+\.json)|content\/smdv-[a-f0-9]+\/[\w-]+\.(?:webp|png|jpe?g))$/u;
const facebookEnglishBook = 'offline-data/chapters-en/tuyen-tap-phap-facebook-quang-tu.json';
const facebookEnglishRevision = 'f3508460887c44f495eac7aefe68f1e41f892226a4d742b10a80560b9e44a3ea';

export async function readPublicMedia(request: Request, key: string, bucket?: R2BucketLike): Promise<Response> {
  if (!publicKey.test(key)) return new Response(null, { status: 404 });
  const range = request.headers.get('range');
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/u.test(range)) return new Response(null, { status: 416 });
  let object;
  try {
    const objectKey = key === facebookEnglishBook
      ? `offline-data/english-revisions/${facebookEnglishRevision}/tuyen-tap-phap-facebook-quang-tu.json`
      : key;
    object = await bucket?.get(objectKey, range ? { range: request.headers } : undefined);
  } catch {
    return new Response(null, { status: 503 });
  }
  if (!object?.body) return new Response(null, { status: 404 });
  const headers = new Headers({
    'Content-Type': types[key.split('.').at(-1)!],
    'Cache-Control': key.endsWith('.json') ? 'public, max-age=300' : 'public, max-age=86400',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  if (range && object.range) {
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? object.size - offset;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}
