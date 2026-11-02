/* Pure calculation logic; no DOM or UI state. */
(function(root){
'use strict';
const d=root.CORR_DATA||(typeof require!=='undefined'?require('./data.js'):null);
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function massToUm(gm2,density){return gm2/density;}
function umToMass(um,density){return um*density;}
function firstYearRange(metal,category){
 const m=d.metals[metal], idx=d.categories.indexOf(category);
 if(!m||idx<0)return null;
 const r=m.ranges[idx];
 if(!r)return null;
 return metal==='aluminium'?
  {lo:r[0],hi:r[1],unit:'g/(m²·a)',isMass:true}:
  {lo:r[0],hi:r[1],unit:'µm/a',isMass:false};
}
function selectedR(metal,category,choice,custom){
 const range=firstYearRange(metal,category);
 if(choice==='custom'){
   if(!finite(custom)||custom<0)return null;
   return metal==='aluminium'?massToUm(custom,d.metals[metal].density):custom;
 }
 if(!range||range.hi===null)return null;
 const native=choice==='mid'?(range.lo+range.hi)/2:range.hi;
 return range.isMass?massToUm(native,d.metals[metal].density):native;
}
function gradeFromRate(metal,rUm){
 if(!d.metals[metal]||!finite(rUm)||rUm<0)return null;
 const native=metal==='aluminium'?umToMass(rUm,d.metals[metal].density):rUm;
 if(metal==='aluminium'){
   // C1 is qualitative ('negligible') and cannot be determined numerically.
   if(native<=0.6)return 'C2';
   if(native<=2)return 'C3';
   if(native<=5)return 'C4';
   if(native<=10)return 'C5';
   return 'CX';
 }
 const values=d.metals[metal].ranges;
 for(let i=0;i<values.length;i++)if(native<=values[i][1]+1e-10)return d.categories[i];
 return null; // over ISO 9223 CX numerical upper bound
}
function doseResponse(metal,env){
 if(!d.metals[metal])return null;
 const {T,RH,Pd,Sd}=env;
 if(![T,RH,Pd,Sd].every(finite)||RH<0||RH>100||Pd<0||Sd<0)return null;
 let f,r;
 switch(metal){
 case 'steel':
   f=(T<=10?0.150:-0.054)*(T-10);
   r=1.77*Math.pow(Pd,0.52)*Math.exp(0.020*RH+f)+0.102*Math.pow(Sd,0.62)*Math.exp(0.033*RH+0.040*T);break;
 case 'zinc':
   f=(T<=10?0.038:-0.071)*(T-10);
   r=0.0129*Math.pow(Pd,0.44)*Math.exp(0.046*RH+f)+0.0175*Math.pow(Sd,0.57)*Math.exp(0.008*RH+0.085*T);break;
 case 'copper':
   f=(T<=10?0.126:-0.080)*(T-10);
   r=0.0053*Math.pow(Pd,0.26)*Math.exp(0.059*RH+f)+0.01025*Math.pow(Sd,0.27)*Math.exp(0.036*RH+0.049*T);break;
 case 'aluminium':
   f=(T<=10?0.009:-0.043)*(T-10);
   r=0.0042*Math.pow(Pd,0.73)*Math.exp(0.025*RH+f)+0.0018*Math.pow(Sd,0.60)*Math.exp(0.020*RH+0.094*T);break;
 }
 return finite(r)?r:null;
}
function outsideModelRange(env){
 return Object.entries(d.envRanges).filter(([key,[lo,hi]])=>!finite(env[key])||env[key]<lo||env[key]>hi).map(([key])=>key);
}
function annexARecord(metal,category,unit){
 if(!d.metals[metal]||!d.categories.includes(category))return null;
 // A.1 mass and A.2 thickness are independent rounded datasets.
 if(unit){
  const licensed=d.annexA.licensedEntries[`${metal}:${category}:${unit}`];
  if(licensed)return licensed;
  const verified=d.annexA.entries[`${metal}:${category}:${unit}`];
  if(verified)return verified;
  const legacy=d.annexA.entries[`${metal}:${category}`];
  return legacy&&legacy.unit===unit?legacy:null;
 }
 const native=metal==='aluminium'?'g/m²':'µm';
 return d.annexA.licensedEntries[`${metal}:${category}:${native}`]
   ||d.annexA.entries[`${metal}:${category}:${native}`]
   ||null;
}
// For unavailable Annex A original rows, calculate *independent reference nodes*
// from the category FIRST-YEAR UPPER BOUND and B1; they are never called table data.
// These approximate Annex A's illustrative method but DO NOT reproduce its rounding.
function annexASeries(metal,category,unit='µm'){
 const m=d.metals[metal],i=d.categories.indexOf(category);
 if(!m||i<0||!['µm','g/m²'].includes(unit))return null;
 const verified=annexARecord(metal,category,unit);
 if(verified&&verified.values?.length===d.annexA.years.length&&verified.values.every(finite)){
  return {source:'original',table:verified.table|| (unit==='µm'?'A.2':'A.1'),unit,values:[...verified.values]};
 }
 const first=unit==='µm'?m.ranges[i]?.[1]:m.massUpper[i];
 if(!finite(first))return null;
 return {source:'calculated',table:null,unit,values:d.annexA.years.map(t=>first*Math.pow(t,m.b1))};
}
function interpolationAt(xs,ys,t){
 if(!finite(t)||t<xs[0]||t>xs[xs.length-1])return null;
 for(let i=0;i<xs.length;i++){
  if(Math.abs(t-xs[i])<1e-10)return ys[i];
  if(i>0&&t<xs[i])return ys[i-1]+(ys[i]-ys[i-1])*(t-xs[i-1])/(xs[i]-xs[i-1]);
 }
 return null;
}
function annexAValue(metal,category,t,unit='µm'){
 if(!finite(t)||t<1||t>20)return null;
 const s=annexASeries(metal,category,unit);if(!s)return null;
 return interpolationAt(d.annexA.years,s.values,t);
}
function annexALoss(metal,category,t){
 // Kept for backward compatibility; internal calc logic is in depth-equivalent µm.
 const native=metal==='aluminium'?'g/m²':'µm';
 const value=annexAValue(metal,category,t,native);
 return value===null?null:(native==='g/m²'?massToUm(value,d.metals[metal].density):value);
}
// Public unit-specific result path: Annex A mass values do not come from rounded thickness data.
function outputValue(method,ctx,t,unit='µm'){
 if(method==='a')return annexAValue(ctx.metal,ctx.category,t,unit);
 const v=modelValue(method,ctx,t);
 if(!finite(v))return null;
 return unit==='g/m²'?umToMass(v,d.metals[ctx.metal].density):v;
}
// Local licensed-data import. Never sends data over the network; resets on reload.
// Format: metal,category,unit,1,2,5,10,15,20. Must include all six numeric nodes per row.
function parseLicensedCsv(text){
 if(typeof text!=='string'||text.length>150000)return {ok:false,error:'文件不是有效的 CSV，或文件过大。'};
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===','){row.push(cell.trim());cell='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());cell='';if(row.some(x=>x!==''))rows.push(row);row=[];}
  else cell+=ch;
 }
 if(quoted)return {ok:false,error:'CSV 存在未闭合的引号。'};
 row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);
 const head=['metal','category','unit','1','2','5','10','15','20'];
 if(!rows.length||rows[0].length!==head.length||!head.every((h,i)=>rows[0][i].replace(/^\uFEFF/,'')===h))
  return {ok:false,error:'CSV 表头必须为 metal,category,unit,1,2,5,10,15,20。'};
 const entries={};
 for(let i=1;i<rows.length;i++){
  const r=rows[i];if(r.length!==9)return {ok:false,error:`第 ${i+1} 行列数应为 9。`};
  const [metal,category,unit]=r;
  if(r.slice(3).every(v=>v===''))continue; // leave unused template rows blank
  if(!d.metals[metal]||!d.categories.includes(category)||!['µm','g/m²'].includes(unit)|| (metal==='aluminium'&&unit==='µm'))
   return {ok:false,error:`第 ${i+1} 行金属、等级或单位无效。`};
  const values=r.slice(3).map(Number);
  if(r.slice(3).some(v=>v==='')||values.some(v=>!finite(v)||v<0)||values.some((v,j)=>j>0&&v<values[j-1]))
   return {ok:false,error:`第 ${i+1} 行应填写 6 个非负、非递减节点值。`};
  const key=`${metal}:${category}:${unit}`;
  if(entries[key])return {ok:false,error:`存在重复行 ${key}。`};
  entries[key]={table:unit==='µm'?'A.2':'A.1',unit,values};
 }
 if(!Object.keys(entries).length)return {ok:false,error:'CSV 中没有有效数据行。'};
 return {ok:true,entries,count:Object.keys(entries).length};
}
function loadLicensedCsv(text){
 const r=parseLicensedCsv(text);
 if(r.ok)d.annexA.licensedEntries={...d.annexA.licensedEntries,...r.entries};
 return r;
}
function annexBRates(metal,category){
 const m=d.metals[metal];const i=d.categories.indexOf(category);
 if(!m?.annexB||i<0)return null;
 return {rav:m.annexB.rav[i],rlin:m.annexB.rlin[i]};
}
// ISO 9224:2012 Eq. (1) for 0–20 years; Eq. (3) for t > 20 years.
// Eq. (3) is tangent continuation at year 20: continuous in value and slope.
function iso9224TimeFactor(t,b){
 if(!finite(t)||t<0||!finite(b))return null;
 return t<=20?Math.pow(t,b):Math.pow(20,b)+b*Math.pow(20,b-1)*(t-20);
}
function modelValue(method,ctx,t){
 if(!finite(t)||t<0||t>50)return null;
 const {metal,category,r}=ctx;
 if(!d.metals[metal])return null;
 if(method==='b1'||method==='b2')return finite(r)&&r>=0?r*iso9224TimeFactor(t,d.metals[metal][method]):null;
 if(method==='a')return annexALoss(metal,category,t);
 const rates=annexBRates(metal,category);
 if(!rates)return null;
 if(method==='b')return rates.rav*Math.min(10,t)+rates.rlin*Math.max(0,t-10);
 if(method==='quick')return rates.rlin*t;
 return null;
}
function evaluate(input){
 const {metal,category,choice,custom,mode,years,env}=input;
 const m=d.metals[metal];if(!m||!Number.isInteger(years)||years<1||years>50)return {valid:false};
 let rate, grade,originalCategory;
 if(mode==='env'){
   rate=doseResponse(metal,env);grade=gradeFromRate(metal,rate);
   originalCategory=grade;
 }else{
   rate=selectedR(metal,category,choice,custom);
   grade=category;
   originalCategory=gradeFromRate(metal,rate);
 }
 if(rate===null||!finite(rate))return {valid:false,rate:null,grade:grade||null};
 const ctx={metal,category:mode==='env'?grade:category,r:rate};
 const values=Object.fromEntries(d.methods.map(method=>[method.id,modelValue(method.id,ctx,years)]));
 return {valid:true,rate,grade:ctx.category,originalCategory,ctx,values,years,
   massRate:umToMass(rate,m.density),
   outOfRange:mode==='env'?outsideModelRange(env):[],
   modelGradeAvailable:Boolean(ctx.category),
   expectedUpper:mode==='grade'&&choice==='upper',
   annexAAvailable:Boolean(annexASeries(metal,ctx.category,metal==='aluminium'?'g/m²':'µm')),
   annexBAvailable:Boolean(annexBRates(metal,ctx.category))};
}
const api={finite,massToUm,umToMass,firstYearRange,selectedR,gradeFromRate,
  doseResponse,outsideModelRange,annexARecord,annexASeries,annexAValue,annexALoss,outputValue,parseLicensedCsv,loadLicensedCsv,annexBRates,iso9224TimeFactor,modelValue,evaluate};
root.CORR_CALC=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
