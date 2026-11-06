import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareSite} from '../ubuntu/site.mjs';
import {staticServer} from '../ubuntu/preview.mjs';
import {health} from '../ubuntu/healthcheck.mjs';
test('prefixed release serves complete module graph and detects a damaged deployment asset',async()=>{const dir=mkdtempSync(join(tmpdir(),'arcade-deploy-')),sha='a'.repeat(40);prepareSite(process.cwd(),dir,sha);const server=staticServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;try{await health(origin,sha);for(const path of ['/js/app.js','/tradegames/../package.json','/tradegames/%2e%2e%2fpackage.json','/tradegames/.git/config'])assert.notEqual((await fetch(origin+path)).status,200);assert.equal((await fetch(origin+'/tradegames/missing.js')).status,404);const file=join(dir,'js/app.js'),original=readFileSync(file,'utf8');writeFileSync(file,original+'\n// corrupted transfer\n');await assert.rejects(health(origin,sha),/asset checksum/);}finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}});
