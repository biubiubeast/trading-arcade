import test from 'node:test';
import assert from 'node:assert/strict';
import {value,MARKET,pnl,fees,debit,analyze,mergeLeg,checkLevel,delta} from '../dist/js/engine.js';
import {LEVELS,SANDBOX} from '../dist/js/levels.js';
import {readProgress,saveProgress,validDraft,KEY} from '../dist/js/storage.js';
const near=(actual,expected,tol=1e-5)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
const leg=(type,strike=100,qty=1)=>({type,strike,qty});
test('known ATM European price and put-call parity',()=>{
  near(value('call',100,100,365,.2),7.965567,3e-5);
  for(const s of [0,20,90,100,110,1000])for(const k of [80,100,120])near(value('call',k,s)-value('put',k,s),s-k);
});
test('expiry, zero spot, zero volatility have exact intrinsic values',()=>{
 near(value('put',100,0),100);near(value('call',100,110,0),10);near(value('put',100,80,0),20);near(value('put',100,80,30,0),20);near(value('stock',0,120),120);near(value('cash',0,120),10);
});
test('time-zero revaluation equals fees only; entry cost stays fixed',()=>{
 const legs=[leg('call'),leg('put')];near(pnl(legs,100,30,.4),-.2);assert.ok(pnl(legs,100,30,.6)>pnl(legs,100,30,.4));assert.ok(pnl(legs,100,1,.4)<pnl(legs,100,30,.4));
});
test('fees are charged once per net position unit including stock and cash',()=>{
 const legs=[leg('call',100,2),leg('call',110,-1),leg('cash',0)];near(fees(legs),.4);near(pnl(legs,120)+debit(legs),40-10+10);
});
test('long and short Call tail risks extend beyond chart boundaries',()=>{
 const long=analyze([leg('call')]),short=analyze([leg('call',100,-1)]);assert.equal(long.maxProfit,Infinity);near(long.maxLoss,debit([leg('call')]));assert.equal(short.maxLoss,Infinity);near(short.maxProfit,-debit([leg('call',100,-1)]));
});
test('long Put gain is finite because spot cannot fall below zero',()=>{
 const a=analyze([leg('put')]);near(a.maxProfit,100-debit([leg('put')]));near(a.maxLoss,debit([leg('put')]));
});
test('covered Call is bounded above and short stock is unbounded below',()=>{
 const covered=analyze([leg('stock',0),leg('call',110,-1)]);near(covered.maxProfit,110-covered.debit);assert.equal(analyze([leg('stock',0,-1)]).maxLoss,Infinity);
});
test('bull spread extrema and break-even are exact',()=>{
 const legs=LEVELS[1].solution,a=analyze(legs);near(a.maxLoss,a.debit);near(a.maxProfit,10-a.debit);near(a.breakevens[0],100+a.debit);near(pnl(legs,a.breakevens[0]),0);
});
test('straddle has two exact break-even points',()=>{
 const a=analyze(LEVELS[3].solution);assert.equal(a.breakevens.length,2);near(a.breakevens[0],100-a.debit);near(a.breakevens[1],100+a.debit);
});
test('butterfly peak is at the middle strike, risk equal to cost',()=>{
 const legs=LEVELS[4].solution,a=analyze(legs);near(a.maxProfit,pnl(legs,100));near(a.maxLoss,a.debit);near(pnl(legs,0),pnl(legs,100000));assert.equal(a.breakevens.length,2);
});
test('all six teaching levels have passing reference solutions and fail empty',()=>{
 for(const l of LEVELS){assert.ok(checkLevel(l,l.solution).pass,l.id);assert.equal(checkLevel(l,[]).pass,false,l.id);}
});
test('single cheap OTM Call fails first level scenario, expensive ITM fails budget',()=>{
 assert.equal(checkLevel(LEVELS[0],[leg('call',110)]).pass,false);assert.equal(checkLevel(LEVELS[0],[leg('call',90)]).pass,false);
});
test('invalid quantity, unavailable tools, selling, and excess units cannot pass',()=>{
 for(const legs of [[leg('put')],[leg('call',100,-1)],[leg('call',100,2)],[leg('call',105)],[leg('call',100,.5)]])assert.equal(checkLevel(LEVELS[0],legs).valid,false);
});
test('analytical risk bounds contain a dense range of scenario outcomes',()=>{
 for(const l of LEVELS){const a=analyze(l.solution);for(let s=0;s<=400;s+=.7){const p=pnl(l.solution,s);assert.ok(p>=-a.maxLoss-1e-8);assert.ok(p<=a.maxProfit+1e-8);}}
});
test('netting, cancellation and unit cap preserve composition semantics',()=>{
 const one=[leg('call')];assert.deepEqual(mergeLeg(one,leg('call',100,-1)),[]);assert.equal(mergeLeg(one,leg('call'),1),null);assert.equal(one[0].qty,1);assert.equal(mergeLeg(one,leg('put'))[1].qty,1);
});
test('cash has zero P&L before fee and constant value across scenarios',()=>{
 const legs=[leg('cash',0)];for(const s of [0,100,1000])near(pnl(legs,s),-.1);near(analyze(legs).maxLoss,.1);assert.equal(analyze(legs).maxProfit,0);
});
test('delta respects put-call parity and model units',()=>{
 near(delta([leg('call')])-delta([leg('put')]),1,1e-4);near(delta([leg('stock',0)]),1,1e-6);
});
test('corrupted storage or denied storage degrades safely',()=>{
 assert.equal(readProgress({getItem:()=>'{broken'}).version,1);assert.equal(readProgress({getItem:()=>{throw Error();}}).lastLevel,0);assert.equal(saveProgress({}, {setItem:()=>{throw Error();}}),false);
});
test('stored drafts reject invalid products, duplicates and non-finite quantities',()=>{
 for(const raw of [[leg('call',999)],[leg('call',100,Infinity)],[leg('call'),leg('call')],[leg('cash',0)]])assert.deepEqual(validDraft(raw,LEVELS[0]),[]);
 assert.deepEqual(validDraft(LEVELS[4].solution,LEVELS[4]),LEVELS[4].solution);assert.deepEqual(validDraft([leg('cash',0)],SANDBOX),[leg('cash',0)]);
});
test('progress schema validates stars and persists attempt hint usage',()=>{
 const raw={version:1,completed:{bad:{stars:'<img>'},good:{stars:3}},hintUse:{a:2,b:9},lastLevel:200,drafts:{}};const p=readProgress({getItem:()=>JSON.stringify(raw)});assert.equal(p.completed.bad,undefined);assert.equal(p.completed.good.stars,3);assert.deepEqual(p.hintUse,{a:2});assert.equal(p.lastLevel,0);let stored;saveProgress(p,{setItem:(key,s)=>{assert.equal(key,KEY);stored=s;}});assert.equal(JSON.parse(stored).hintUse.a,2);
});
