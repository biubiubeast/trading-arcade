import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
export function staticServer(root){root=resolve(root);return http.createServer(async(req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/tradegames/')){res.writeHead(404).end();return;}
 const raw=decodeURIComponent(url.pathname.slice('/tradegames'.length));if(raw.includes('\\')||raw.split('/').includes('..')){res.writeHead(400).end();return;}
 const file=resolve(root,'.'+(raw==='/'?'/index.html':raw));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 const bytes=await readFile(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404).end('Not found');}});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)staticServer(process.argv[2]).listen(Number(process.argv[3]||4174),'127.0.0.1');
