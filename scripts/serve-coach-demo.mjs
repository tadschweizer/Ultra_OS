import http from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../coach-demo/', import.meta.url);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server = http.createServer(async (req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!['index.html','app.js','threshold.js','styles.css','threshold.css','favicon.svg','vercel.json'].includes(file)) { res.writeHead(404);res.end('Not found');return; }
  try { const data = await readFile(new URL(file,root));res.writeHead(200,{'Content-Type':types[file.slice(file.lastIndexOf('.'))],'Cache-Control':'no-store'});res.end(data); }
  catch { res.writeHead(404);res.end('Not found'); }
});
server.listen(4173,'127.0.0.1',()=>console.log('Coach demo: http://127.0.0.1:4173'));
