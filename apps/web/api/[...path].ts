// Vercel same-origin proxy for AgentPlace API/Auth. This keeps Better Auth session
// cookies first-party even while the core API runs on Railway.
export default async function handler(req: any, res: any) {
  const origin = String(process.env.AGENT_PLACE_API_ORIGIN || '').replace(/\/$/, '');
  if (!origin) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'API_PROXY_NOT_CONFIGURED', message: 'AGENT_PLACE_API_ORIGIN is required on Vercel.' }));
    return;
  }

  const incoming = new URL(req.url || '/', 'https://agentplace.invalid');
  const target = `${origin}${incoming.pathname}${incoming.search}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (value === undefined || name.toLowerCase() === 'host' || name.toLowerCase() === 'content-length') continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }
  headers.set('x-forwarded-host', String(req.headers?.host || ''));
  headers.set('x-forwarded-proto', 'https');

  const method = String(req.method || 'GET').toUpperCase();
  let body: Uint8Array | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    if (req.body !== undefined && req.body !== null) {
      body = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    } else {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      body = Buffer.concat(chunks);
    }
  }

  const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, name) => {
    if (['content-length', 'transfer-encoding', 'content-encoding'].includes(name.toLowerCase())) return;
    if (name.toLowerCase() !== 'set-cookie') res.setHeader(name, value);
  });
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie ? getSetCookie.call(upstream.headers) : [];
  if (cookies.length) res.setHeader('set-cookie', cookies);
  else {
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) res.setHeader('set-cookie', cookie);
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.end(bytes);
}
