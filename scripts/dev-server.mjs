import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { build, output, publicFiles } from './build-site.mjs';

await build();
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    // Local browser QA only; scripts/ is never included in the published site.
    if (pathname === '/__preview__/mobile') {
      const requested = url.searchParams.get('page') || '/';
      const page = requested === '/' || (/^\/[a-z-]+$/.test(requested) && publicFiles.includes(requested.slice(1)+'.html')) ? requested : '/';
      const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>CRIT mobile layout preview</title><body style="margin:0;background:#e4e9ee;font:14px system-ui;text-align:center"><p>Mobile layout preview · 390px viewport</p><iframe title="CRIT mobile website" src="'+page+'" style="width:390px;height:880px;border:1px solid #8292a3;background:#06101f;max-width:calc(100% - 24px)"></iframe></body></html>';
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex','Cache-Control':'no-store'}); res.end(html); return;
    }
    if (pathname.includes('\0') || pathname.split('/').some(p => p.startsWith('.'))) throw new Error('invalid path');
    let file = path.join(output, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(output + path.sep)) throw new Error('invalid path');
    if (pathname.endsWith('.html') && !pathname.startsWith('/google')) {
      res.writeHead(301, { Location: (pathname === '/index.html' ? '/' : pathname.slice(0,-5)) + url.search }); res.end(); return;
    }
    if (pathname !== '/' && pathname.endsWith('/')) {
      res.writeHead(301, { Location: pathname.slice(0,-1) + url.search }); res.end(); return;
    }
    if (!path.extname(file)) file += '.html';
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Robots-Tag':'noindex', 'X-Content-Type-Options':'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8', 'X-Robots-Tag':'noindex' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(path.join(output, '404.html')));
  }
});
server.listen(Number(process.env.PORT || 4173), process.env.HOST || '0.0.0.0', () => console.log(`CRIT preview listening on port ${server.address().port}`));
