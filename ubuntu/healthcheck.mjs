import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function health(origin,expectedCommit){
 const base=origin.replace(/\/$/,'')+'/tradegames/';
 const get=async path=>{const r=await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(10000)});assert.equal(r.status,200,path+' status');return r;};
 const page=await get(''),html=await page.text();assert.match(html,/<title>.*交易游乐场/);assert.match(html,/id="app"/);
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^https?:/.test(match[1]))continue;assert.ok(new URL(match[1],base).pathname.startsWith('/tradegames/'),'asset prefix: '+match[1]);}
 const manifest=await(await get('version.json')).json();assert.match(manifest.commit,/^[a-f0-9]{40}$/);if(expectedCommit)assert.equal(manifest.commit,expectedCommit);
 assert.ok(Object.keys(manifest.files).length>=15,'complete static site');
 const files=Object.entries(manifest.files);for(let i=0;i<files.length;i+=5)await Promise.all(files.slice(i,i+5).map(async([name,expected])=>{assert.ok(!name.startsWith('/')&&!name.split('/').includes('..'));const r=await get(name),bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,'asset checksum: '+name);if(name.endsWith('.js'))assert.match(r.headers.get('content-type')||'',/javascript/);if(name.endsWith('.css'))assert.match(r.headers.get('content-type')||'',/css/);if(name.endsWith('.json'))JSON.parse(bytes.toString('utf8'));}));
 return manifest.commit;
}
export async function accessHealth(origin,mode){if(mode==='public')return health(origin);const r=await fetch(origin+'/tradegames/',{redirect:'manual',signal:AbortSignal.timeout(10000)});assert.equal(r.status,401,'private site requires credentials');assert.match(r.headers.get('www-authenticate')||'',/^Basic /i);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await health(process.argv[2],process.argv[3]);console.log('PASS tradegames page, prefix and complete asset checksums');}
