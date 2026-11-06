export const KEY='trade-arcade:v1';
const empty=()=>({version:1,completed:{},drafts:{},hintUse:{},lastLevel:0});
export function readProgress(storage) {
  try {
    const p=JSON.parse((storage||globalThis.localStorage).getItem(KEY));if(p?.version!==1)return empty();
    const completed={},hintUse={};
    for(const [id,item] of Object.entries(p.completed||{}))if(item && Number.isInteger(item.stars)&&item.stars>=1&&item.stars<=3)completed[id]={stars:item.stars,completedAt:typeof item.completedAt==='string'?item.completedAt.slice(0,30):null,legs:Array.isArray(item.legs)?item.legs:[],modelVersion:1};
    for(const [id,n] of Object.entries(p.hintUse||{}))if(Number.isInteger(n)&&n>=0&&n<=2)hintUse[id]=n;
    return {version:1,completed,drafts:p.drafts&&typeof p.drafts==='object'?p.drafts:{},hintUse,lastLevel:Number.isInteger(p.lastLevel)&&p.lastLevel>=0&&p.lastLevel<6?p.lastLevel:0};
  }catch{return empty();}
}
export function saveProgress(p,storage){try {(storage||globalThis.localStorage).setItem(KEY,JSON.stringify(p));return true;}catch{return false;}}
export function validDraft(raw,level) {
  if(!Array.isArray(raw)||raw.length>8)return [];
  const valid=raw.every(l=>l && level.types.includes(l.type) && Number.isInteger(l.qty) && l.qty!==0 && Math.abs(l.qty)<=8 && (level.sell||l.qty>0) && (['call','put'].includes(l.type)?level.strikes.includes(l.strike):l.strike===0));
  const ids=raw.map(l=>l.type+':'+l.strike);
  return valid&&new Set(ids).size===ids.length&&raw.reduce((s,l)=>s+Math.abs(l.qty),0)<=level.maxUnits?raw.map(l=>({type:l.type,strike:l.strike,qty:l.qty})):[];
}
