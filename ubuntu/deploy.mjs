import {spawnSync,spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,existsSync,symlinkSync,renameSync,readlinkSync,unlinkSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import net from 'node:net';
import {homedir} from 'node:os';
process.umask(0o077);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),appRoot=process.env.TRADEGAMES_APP_ROOT||resolve(homedir(),'apps/tradegames');
const run=(command,args,options={})=>{const r=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});if(r.status!==0)throw Error(`${command} failed (${r.status??r.error?.code})`);return r;};
const git=(...args)=>run('git',args,{encoding:'utf8',stdio:['ignore','pipe','inherit']}).stdout.trim();
if(git('branch','--show-current')!=='main')throw Error('Deploy from main only');
if(git('status','--porcelain'))throw Error('Checkout has local changes. Commit or review them before updating.');
if(!process.env.TRADEGAMES_DEPLOY_UPDATED){git('pull','--ff-only','origin','main');const next=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{cwd:root,stdio:'inherit',env:{...process.env,TRADEGAMES_DEPLOY_UPDATED:'1'}});process.exit(next.status??1);}
const access=JSON.parse(readFileSync(resolve(appRoot,'setup/access.json'),'utf8'));if(!['public','private'].includes(access.mode))throw Error('Configure site access first');
const sha=git('rev-parse','HEAD'),id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+sha.slice(0,12),release=resolve(appRoot,'releases',id),source=resolve(release,'source');mkdirSync(source,{recursive:true,mode:0o700});
const archive=resolve(release,'source.tar'),fd=openSync(archive,'wx',0o600);try{run('git',['archive','--format=tar','HEAD'],{stdio:['ignore',fd,'inherit']});}finally{closeSync(fd);}run('tar',['-xf',archive,'-C',source]);unlinkSync(archive);
console.log('Checking trading-arcade '+sha.slice(0,12));
const tests=run('git',['ls-files','tests/*.test.js'],{encoding:'utf8',stdio:['ignore','pipe','inherit']}).stdout.trim().split('\n');
run(process.execPath,['--test',...tests],{cwd:source});run(process.execPath,['scripts/check.mjs'],{cwd:source});
const {prepareSite}=await import(pathToFileURL(resolve(source,'ubuntu/site.mjs')).href),{health,accessHealth}=await import(pathToFileURL(resolve(source,'ubuntu/healthcheck.mjs')).href);prepareSite(source,resolve(release,'site'),sha);writeFileSync(resolve(release,'COMMIT'),sha+'\n');
const port=Number(process.env.TRADEGAMES_CANDIDATE_PORT||4317);await new Promise((ok,bad)=>{const server=net.createServer();server.once('error',()=>bad(Error('Candidate port is in use')));server.listen(port,'127.0.0.1',()=>server.close(ok));});
const log=openSync(resolve(release,'candidate.log'),'a',0o600),candidate=spawn(process.execPath,[resolve(source,'ubuntu/preview.mjs'),resolve(release,'site'),String(port)],{cwd:release,stdio:['ignore',log,log]});closeSync(log);
try{let last,okay=false;for(let i=0;i<40;i++){if(candidate.exitCode!==null)throw Error('Candidate exited');try{await health('http://127.0.0.1:'+port,sha);okay=true;break;}catch(e){last=e;}await new Promise(r=>setTimeout(r,250));}if(!okay)throw last;}finally{const exited=new Promise(r=>candidate.once('exit',r));candidate.kill('SIGTERM');await Promise.race([exited,new Promise(r=>setTimeout(r,3000))]);if(candidate.exitCode===null&&candidate.signalCode===null)candidate.kill('SIGKILL');}
const current=resolve(appRoot,'current'),previous=existsSync(current)?readlinkSync(current):null;
function activate(target){const temporary=resolve(appRoot,'current.next');if(existsSync(temporary))unlinkSync(temporary);symlinkSync(target,temporary);renameSync(temporary,current);}
activate(release);
if(existsSync(resolve(appRoot,'setup/route-installed'))){try{await accessHealth(access.origin,access.mode);if(access.mode==='public')await health(access.origin,sha);}catch(error){if(previous)activate(previous);else unlinkSync(current);console.error('Restored previous static release');throw error;}}
else console.log('Initial release ready; install the company Caddy route to enable the website.');
console.log('DEPLOYED '+sha+'\n'+access.origin+'/tradegames/\nExisting browser learning records and site access configuration preserved.');
