import {existsSync,mkdirSync,writeFileSync,chmodSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {confirmedPassword} from './password-prompt.mjs';
process.umask(0o077);
const app=process.env.TRADEGAMES_APP_ROOT||resolve(homedir(),'apps/tradegames'),dir=resolve(app,'setup'),file=resolve(dir,'access.json'),mode=process.argv[2]||'private';
if(existsSync(file))throw Error('Access configuration already exists; nothing changed');
if(!['public','private'].includes(mode))throw Error('Use private or public');
const origin=process.env.TRADEGAMES_PUBLIC_ORIGIN,username=process.env.TRADEGAMES_USERNAME||'admin';
if(!origin||new URL(origin).origin!==origin||new URL(origin).protocol!=='https:')throw Error('Set TRADEGAMES_PUBLIC_ORIGIN to the HTTPS origin');
if(!/^[a-z][a-z0-9_-]{2,31}$/.test(username))throw Error('Invalid account name');
mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
if(mode==='private'){
 console.log('Create tradegames login account: '+username+'. The browser will request this account and password.');
 const password=await confirmedPassword();if(Buffer.byteLength(password,'utf8')>72)throw Error('Use a password of at most 72 UTF-8 bytes (for example 12–24 ordinary characters). Nothing saved.');
 const result=spawnSync(process.env.CADDY_BIN||resolve(homedir(),'.local/bin/caddy'),['hash-password','--algorithm','bcrypt','--bcrypt-cost','12'],{input:password+'\n',encoding:'utf8'});
 const hash=result.stdout.trim();if(result.status!==0||!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash))throw Error('Unable to securely hash password; nothing saved');
 const temporary=resolve(dir,'auth.caddy.next');writeFileSync(temporary,'basic_auth {\n    '+username+' '+hash+'\n}\n',{mode:0o600,flag:'wx'});renameSync(temporary,resolve(dir,'auth.caddy'));
}
writeFileSync(file,JSON.stringify({mode,origin,username:mode==='private'?username:null},null,2)+'\n',{mode:0o600,flag:'wx'});
console.log('Saved server configuration. Password was not printed.');
