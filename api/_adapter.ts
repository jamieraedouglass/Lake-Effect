import type { IncomingMessage, ServerResponse } from 'node:http';

export type WebHandler = (request: Request) => Promise<Response>;

type NodeRequest = IncomingMessage & { body?: unknown };

function isWebRequest(value: unknown): value is Request {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Request).method === 'string' &&
    typeof (value as Request).headers?.get === 'function'
  );
}

function readBody(req: NodeRequest): Promise<string> {
  if (req.body !== undefined && req.body !== null) {
    return Promise.resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function toWebRequest(req: NodeRequest): Promise<Request> {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `${proto}://${host}`);

  const method = (req.method ?? 'GET').toUpperCase();
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    const body = await readBody(req);
    if (body) init.body = body;
  }
  return new Request(url, init);
}

async function writeResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}

export function handleRequest(handler: WebHandler) {
  return async function vercelHandler(
    reqOrRequest: Request | NodeRequest,
    res?: ServerResponse
  ): Promise<Response | void> {
    if (isWebRequest(reqOrRequest)) {
      return handler(reqOrRequest);
    }
    const response = await handler(await toWebRequest(reqOrRequest));
    if (res) await writeResponse(response, res);
  };
}
