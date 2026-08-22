function isWebRequest(value) {
  return Boolean(value) && typeof value.headers?.get === 'function' && typeof value.method === 'string';
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function toWebRequest(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `${proto}://${host}`);

  const method = (req.method ?? 'GET').toUpperCase();
  const init = { method, headers: req.headers };
  if (method !== 'GET' && method !== 'HEAD') {
    const body = await readBody(req);
    if (body) init.body = body;
  }
  return new Request(url, init);
}

async function writeResponse(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}

export function handleRequest(handler) {
  return async function vercelHandler(reqOrRequest, res) {
    if (isWebRequest(reqOrRequest)) {
      return handler(reqOrRequest);
    }
    const response = await handler(await toWebRequest(reqOrRequest));
    await writeResponse(response, res);
  };
}
