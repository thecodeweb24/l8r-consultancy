import { app } from '../server.js';

export default function handler(req, res) {
  const requestUrl = new URL(req.url, 'http://vercel.local');
  const routedPath = requestUrl.searchParams.get('path');
  if (routedPath?.startsWith('/')) {
    requestUrl.searchParams.delete('path');
    const query = requestUrl.searchParams.toString();
    req.url = `${routedPath}${query ? `?${query}` : ''}`;
    delete req.originalUrl;
  }
  app(req, res);
}
