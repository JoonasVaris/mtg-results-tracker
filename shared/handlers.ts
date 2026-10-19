import { getSource, sources } from './sources/index';

/**
 * Framework-agnostic request handler for the JSON API. Used by the Netlify
 * Function in production and by the Vite dev-server middleware locally.
 *
 *   GET /api/formats?source=mtgtop8
 *   GET /api/events?source=mtgtop8&format=EDH
 *   GET /api/event?source=mtgtop8&format=EDH&id=92514
 */
export async function handleApi(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const source = getSource(url.searchParams.get('source'));
  if (!source) return json({ error: 'Unknown source', sources: Object.keys(sources) }, 404);

  try {
    switch (route) {
      case 'formats':
        return json(await source.formats(), 200, 'public, max-age=86400');

      case 'events': {
        const format = url.searchParams.get('format');
        if (!format) return json({ error: 'Missing "format"' }, 400);
        return json(await source.events(format), 200, 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600');
      }

      case 'event': {
        const format = url.searchParams.get('format');
        const id = url.searchParams.get('id');
        if (!format || !id) return json({ error: 'Missing "format" or "id"' }, 400);
        return json(await source.event(format, id), 200, 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400');
      }

      default:
        return json({ error: `Unknown route "${route}"` }, 404);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /unknown format|invalid event/i.test(message) ? 400 : 502;
    return json({ error: message }, status, 'no-store');
  }
}

function json(body: unknown, status = 200, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
  });
}
