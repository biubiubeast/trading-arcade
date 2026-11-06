import {cpSync,readdirSync,readFileSync,writeFileSync,statSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
export function prepareSite(source,destination,commit){
 mkdirSync(destination,{recursive:true});cpSync(resolve(source,'dist'),destination,{recursive:true});const files={};
 function walk(dir){for(const name of readdirSync(dir)){const file=resolve(dir,name);if(statSync(file).isDirectory())walk(file);else files[relative(destination,file)]=createHash('sha256').update(readFileSync(file)).digest('hex');}}walk(destination);
 writeFileSync(resolve(destination,'version.json'),JSON.stringify({commit,files})+'\n');
}
