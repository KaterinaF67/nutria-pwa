/* Pure calculations shared by the UI and regression tests. */
(function(root){
'use strict';
const positive=x=>Number.isFinite(+x)&&+x>0;
function macroTargets(kcal,p,f,c){
  if(!positive(kcal)||[p,f,c].some(x=>!Number.isFinite(+x)||+x<0)||Math.abs(+p + +f + +c-100)>.01)throw Error('Укажите положительные калории и проценты БЖУ с суммой 100%.');
  return {energy_kcal:+kcal,protein:kcal*p/400,fat:kcal*f/900,carbohydrate:kcal*c/400};
}
function status(pct,coverage){
  if(pct===null)return 'unknown';
  if(coverage<99.99)return 'partial';
  return pct<80?'low':pct<=120?'good':pct<=150?'over':'high';
}
function aggregate(entries,resolve,nutrients,targets){
  const totals={},contributors={},known={}; let count=0;
  for(const e of entries){const info=resolve(e);if(!positive(e.grams))continue;count++;
    for(const n of nutrients){const v=info?.nutrients?.[n.code];if(v===undefined||v===null||!Number.isFinite(+v))continue;
      const amount=v*e.grams/100;totals[n.code]=(totals[n.code]||0)+amount;
      if(!info.partial?.includes(n.code))known[n.code]=(known[n.code]||0)+1;
      (contributors[n.code]??=[]).push({name:info.name,amount,grams:+e.grams,id:e.id,source:info.source||'',partial:info.partial?.includes(n.code)});
    }
  }
  return {entries,totals,rows:nutrients.map(n=>{const has=Object.hasOwn(totals,n.code),amount=totals[n.code]||0,norm=targets[n.code]||null,cov=count?(known[n.code]||0)/count*100:0,pct=has&&norm?amount/norm*100:null;return {n,amount,norm,pct,cov,noData:!has,status:status(pct,cov),contributors:contributors[n.code]||[]};})};
}
function optimize(items,targets,nutrients){
  if(!items.length)throw Error('Сначала добавьте продукты.');
  const macro=['energy_kcal','protein','fat','carbohydrate'];
  if(macro.some(k=>!positive(targets[k])))throw Error('Сначала задайте все цели КБЖУ в профиле.');
  if(items.some(x=>macro.some(k=>!Number.isFinite(x.nutrients[k]))))throw Error('Для автокоррекции нужны полные данные КБЖУ у всех продуктов.');
  const keys=Object.keys(targets).filter(k=>positive(targets[k])&&items.every(x=>Number.isFinite(x.nutrients[k])));
  const weights=Object.fromEntries(keys.map(k=>[k,macro.includes(k)?(k==='energy_kcal'?12:8):.15]));
  const original=items.map(x=>x.grams),grams=original.slice();
  const totals=g=>Object.fromEntries(keys.map(k=>[k,items.reduce((s,x,i)=>s+x.nutrients[k]*g[i]/100,0)]));
  const score=g=>{const t=totals(g);return keys.reduce((s,k)=>{const r=t[k]/targets[k];const err=macro.includes(k)?r-1:Math.max(0,.8-r,r-1.2);return s+weights[k]*err*err;},0)+g.reduce((s,v,i)=>s+.003*((v-original[i])/Math.max(25,original[i]))**2,0);};
  let best=score(grams);
  for(const step of [50,20,10,5,1]){for(let pass=0;pass<80;pass++){let changed=false;for(let i=0;i<items.length;i++){if(items[i].locked)continue;let win=grams[i],cost=best;for(const d of [-step,step]){const candidate=Math.max(items[i].min??0,Math.min(items[i].max??Math.max(300,original[i]*2),grams[i]+d));const g=grams.slice();g[i]=candidate;const value=score(g);if(value<cost-1e-9){cost=value;win=candidate;}}if(win!==grams[i]){grams[i]=win;best=cost;changed=true;}}if(!changed)break;}}
  return {grams,before:totals(original),after:totals(grams),improved:best<score(original)-1e-8};
}
const api={macroTargets,status,aggregate,optimize,positive};root.NutriaEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
