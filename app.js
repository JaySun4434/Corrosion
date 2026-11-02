(function(){
'use strict';
const data=window.CORR_DATA, calc=window.CORR_CALC;
const $=(id)=>document.getElementById(id);
const elements={metal:$('metal'),category:$('category'),rateChoice:$('rateChoice'),customRate:$('customRate'),customWrap:$('customWrap'),customUnit:$('customUnit'),resultUnit:$('resultUnit'),so2Unit:$('so2Unit'),so2:$('so2'),temp:$('temp'),rh:$('rh'),chloride:$('chloride'),years:$('years'),inputMessage:$('inputMessage')};
let priorSO2Unit='deposition';
let preferredResultUnit='depth';
const state={mode:'grade',visible:new Set(data.methods.map(m=>m.id)),tab:'years',hoverYear:null,pinTooltip:false,current:null,chartMax:20};
function readNum(el){if(!el.value.trim())return NaN;return Number(el.value);}
function fmt(n,digits=2){return typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';}
function sig(n){return typeof n==='number'&&Number.isFinite(n)?String(+n.toFixed(6)):'—';}
// First-year rates are stored internally as µm/a, including aluminium.
// Cumulative mass loss is g/m²; first-year mass rate is g/(m²·a).
// 1 µm across 1 m² corresponds to density (g/cm³) grams of material.
function activeUnit(metal=elements.metal.value){return metal==='aluminium'?'mass':elements.resultUnit.value;}
function lossUnit(metal=elements.metal.value){return activeUnit(metal)==='mass'?'g/m²':'µm';}
function rateUnit(metal=elements.metal.value){return activeUnit(metal)==='mass'?'g/(m²·a)':'µm/a';}
function displayedModel(method,ctx,t){return calc.outputValue(method,ctx,t,lossUnit(ctx.metal));}
function annexLabel(ctx){const a=ctx?calc.annexASeries(ctx.metal,ctx.category,lossUnit(ctx.metal)):null;return a?.source==='calculated'?'Annex A 参考计算':a?.source==='original'?'Annex A 查表法':'Annex A';}
function outputLoss(value,metal=elements.metal.value){return calc.finite(value)?(activeUnit(metal)==='mass'?calc.umToMass(value,data.metals[metal].density):value):null;}
function updateUnitUI(){
 const isAl=elements.metal.value==='aluminium';
 elements.resultUnit.disabled=isAl;
 elements.resultUnit.value=isAl?'mass':preferredResultUnit;
 $('unitHint').hidden=!isAl;
}

function currentInput(){
 const so2=readNum(elements.so2),Pd=elements.so2Unit.value==='concentration'?0.8*so2:so2;
 return {mode:state.mode,metal:elements.metal.value,category:elements.category.value,
  choice:elements.rateChoice.value,custom:readNum(elements.customRate),years:Number(elements.years.value),
  env:{T:readNum(elements.temp),RH:readNum(elements.rh),Pd,Sd:readNum(elements.chloride)}};
}
function updateMode(){
 document.querySelectorAll('.mode-btn').forEach(btn=>{const active=btn.dataset.mode===state.mode;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
 $('gradeInputs').hidden=state.mode!=='grade';$('envInputs').hidden=state.mode!=='env';
}
function updateRateUI(){
 const i=currentInput(),range=calc.firstYearRange(i.metal,i.category),metal=data.metals[i.metal];
 $('customWrap').hidden=i.choice!=='custom'||state.mode!=='grade';
 $('customUnit').textContent=metal.unit;
 if(range){
   const left=range.lo===0?'0':sig(range.lo);
   $('rateRange').textContent=range.hi===null?`区间：> ${left} ${range.unit}（无数值上限）`:`对应区间：${left}–${sig(range.hi)} ${range.unit}`;
 }else $('rateRange').textContent='本等级无可引用的数值范围，请自定义首年速率。';
}
function updateSO2UI(){
 const isPc=elements.so2Unit.value==='concentration';
 $('so2Label').innerHTML=isPc?'SO₂ 空气浓度 <small>µg/m³</small>':'SO₂ 沉降量 <small>mg/(m²·d)</small>';
 $('so2Conversion').textContent=isPc?'按 ISO 9223:2012 表 3 近似换算：Pd = 0.8 × Pc。':'ISO 9223 剂量响应函数使用 SO₂ 年平均沉降量 Pd。';
}
function warning(input,res){
 const issues=[];
 if(!res.valid){
  if(state.mode==='grade'&&input.choice!=='custom'&&calc.firstYearRange(input.metal,input.category)?.hi==null)issues.push('该等级没有明确数值上限；可切换自定义速率。');
  else issues.push('请填写有效的输入数值。');
  return issues.join(' ');
 }
 if(state.mode==='grade'&&input.choice==='custom'&&res.originalCategory!==input.category){
  issues.push('自定义首年速率与所选腐蚀等级不一致；附录仍按所选等级查表。');
 }
 if(state.mode==='env'){
  const labels={T:'温度',RH:'湿度',Pd:'SO₂',Sd:'Cl⁻'};
  if(res.outOfRange.length)issues.push(`${res.outOfRange.map(k=>labels[k]).join('、')}超出 ISO 9223 回归样本区间，结果属于外推。`);
  if(!res.grade)issues.push('首年速率超出 ISO 9223 的数值分级上限，附录法不可用。');
  if(input.metal==='aluminium'&&res.grade==='C2')issues.push('铝 C1 为定性“可忽略”，低速率区间无法仅据数值区分 C1/C2。');
 }
 if(input.metal==='aluminium')issues.push('铝的累计质量损失不代表局部最大点蚀深度。');
 return issues.join(' ');
}
function modelNumbers(){return state.current?.values||{};}
function render(){
 updateMode();updateUnitUI();updateRateUI();updateSO2UI();
 const input=currentInput();
 const invalidEnv=state.mode==='env'&&(!Number.isFinite(input.env.T)||!Number.isFinite(input.env.RH)||input.env.RH<0||input.env.RH>100||!Number.isFinite(input.env.Pd)||input.env.Pd<0||!Number.isFinite(input.env.Sd)||input.env.Sd<0);
 state.current=invalidEnv?{valid:false}:calc.evaluate(input);
 const r=state.current,m=data.metals[input.metal];
 $('yearsBadge').textContent=`${input.years} 年`;
 $('heroTime').textContent=`/ ${input.years} YEARS`;
 $('heroValue').textContent=r.valid?fmt(outputLoss(r.values.b1,input.metal)):'—';
 $('heroUnit').textContent=lossUnit(input.metal);
 document.querySelector('.results-hero').classList.toggle('mass-output',activeUnit(input.metal)==='mass');
 $('chartUnitTitle').textContent=`累计${activeUnit(input.metal)==='mass'?'质量':'厚度'}损失 / ${lossUnit(input.metal)}`;
 $('compareUnit').textContent=`UNIT / ${lossUnit(input.metal)}`;
 document.querySelector('.hero-note').textContent=`ISO 9224 · 公式法 B1 (b = ${m.b1})`;
 $('copyBtn').disabled=!r.valid;$('exportBtn').disabled=!r.valid;
 $('firstYear').innerHTML=r.valid?`${fmt(outputLoss(r.rate,input.metal))} <small>${rateUnit(input.metal)}</small>`:'—';
 $('resultGrade').textContent=r.valid?(r.grade||'超出范围'):'—';
 $('resultYears').innerHTML=`${input.years} <small>年</small>`;
 $('inputSummary').textContent=state.mode==='env'?`${m.en} · Dose-response`:`${m.en} · ${input.category} · ${input.choice==='upper'?'Upper':input.choice==='mid'?'Mid':'Custom'}`;
 $('inputMessage').textContent=invalidEnv?'请填写有效环境参数：RH 应在 0–100%，沉降量不可为负。':warning(input,r);
 $('inputMessage').style.display=$('inputMessage').textContent?'block':'none';
 renderLegend();renderComparison();renderReference();drawChart();
}
function renderLegend(){
 $('legend').innerHTML=data.methods.map(m=>`<label class="legend-item${state.visible.has(m.id)?'':' is-off'}" style="--line-color:${m.color}" data-dash="${Boolean(m.dash)}"><input type="checkbox" data-method="${m.id}" ${state.visible.has(m.id)?'checked':''}><span class="line-swatch" aria-hidden="true"></span>${m.id==='a'?annexLabel(state.current?.ctx):m.name}</label>`).join('');
 document.querySelectorAll('[data-method]').forEach(el=>el.addEventListener('change',()=>{if(el.checked)state.visible.add(el.dataset.method);else state.visible.delete(el.dataset.method);el.closest('label').classList.toggle('is-off',!el.checked);drawChart();}));
}
function renderComparison(){
 const values=modelNumbers();
 $('compareBody').innerHTML=data.methods.map(m=>{
  const v=state.current?.valid?displayedModel(m.id,state.current.ctx,state.current.years):null,valid=typeof v==='number'&&Number.isFinite(v);
  const desc=m.description;
  return `<tr><td><span class="row-dot" style="--c:${m.color}"></span>${m.id==='a'?annexLabel(state.current?.ctx):m.name}</td><td class="numeric ${m.id==='b1'&&valid?'accent-value':''} ${!valid?'no-data':''}">${valid?fmt(v): '—'}</td><td>${desc}</td><td>${m.use}</td></tr>`;
 }).join('');
}
function formatRateInterval(metal,index,type){
 const m=data.metals[metal];if(!m.annexB)return '—';
 const values=m.annexB[type];const hi=values[index];
 return index===0?`≤ ${sig(hi)}`:`> ${sig(values[index-1])} – ≤ ${sig(hi)}`;
}
function tabMeta(label,source=''){return `<div class="ref-meta"><strong>${label}</strong>${source?`<span>${source}</span>`:''}</div>`;}
function renderReference(){
 const el=$('referenceContent'),r=state.current,input=currentInput(),cat=r?.valid?r.grade:null,metal=input.metal,metalInfo=data.metals[metal];
 if(state.tab==='years'){
  if(!r?.valid){el.innerHTML='<div class="ref-empty">请先填写有效参数。</div>';return;}
  const years=Array.from(new Set([1,2,5,10,15,20,25,30,40,50,input.years].filter(y=>y<=50))).sort((a,b)=>a-b);
  el.innerHTML=tabMeta(`${metalInfo.name} · ${cat||'未分级'} · 计算结果`,`单位：${lossUnit(metal)} · 选定 ${input.years} 年`)+`<div class="table-scroll"><table class="reference-table"><thead><tr><th>年限</th>${data.methods.map(m=>`<th>${(m.id==='a'?annexLabel(r.ctx):m.name).replace('计算法','')}</th>`).join('')}</tr></thead><tbody>${years.map(y=>`<tr><td class="${y===input.years?'current-line':''}">${y} 年</td>${data.methods.map(m=>{const v=displayedModel(m.id,r.ctx,y);return `<td class="${y===input.years?'current-line':''}">${fmt(v)}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
  return;
 }
 if(state.tab==='annexA'){
  const unit=lossUnit(metal),series=cat?calc.annexASeries(metal,cat,unit):null;
  if(!series){
   el.innerHTML=tabMeta(`${metalInfo.name} · ${cat||'未分级'}`, 'ISO 9224:2012 Annex A')+'<div class="ref-empty">'+(data.annexA.nonNumeric[`${metal}:${cat}`]||'该等级无数值参考节点。')+'；不提供数值查表结果。</div>';
   return;
  }
  const isOriginal=series.source==='original';
  const source=isOriginal?`ISO 9224:2012 · Table ${series.table} · ${unit}`:`Annex A 参考计算 · ${unit}`;
  el.innerHTML=tabMeta(`${metalInfo.name} · ${cat} · 参考数值`,source)+`<div class="table-scroll"><table class="reference-table"><thead><tr><th>累计损失</th>${data.annexA.years.map(y=>`<th>${y} 年</th>`).join('')}</tr></thead><tbody><tr><td>${unit}</td>${series.values.map(v=>`<td>${sig(v)}</td>`).join('')}</tr></tbody></table></div>`;
  return;
 }
 if(state.tab==='annexB'){
  const index=data.categories.indexOf(cat),rates=cat?calc.annexBRates(metal,cat):null;
  if(!rates){el.innerHTML=tabMeta(`${metalInfo.name} · ${cat||'未分级'}`,'ISO 9224:2012 Annex B')+'<div class="ref-empty">该材料无可用的 Annex B 指导速率数据。</div><p class="ref-caption">Annex B Table B.1 适用于碳钢、锌和铜；本工具不为铝编造两阶段速率。</p>';return;}
  el.innerHTML=tabMeta(`${metalInfo.name} · ${cat} · 指导速率区间摘录`,'ISO 9224:2012 · Table B.1 · µm/a')+`<div class="table-scroll"><table class="reference-table"><thead><tr><th>标准符号</th><th>指导速率区间 · µm/a</th><th>本工具采用上限</th></tr></thead><tbody><tr><td>r_av · 前 10 年</td><td>${formatRateInterval(metal,index,'rav')}</td><td class="original">${sig(rates.rav)}</td></tr><tr><td>r_lin · 10 年后</td><td>${formatRateInterval(metal,index,'rlin')}</td><td class="original">${sig(rates.rlin)}</td></tr>${activeUnit(metal)==='mass'?`<tr><td>r_av · 换算 g/(m²·a)</td><td>—</td><td>${fmt(calc.umToMass(rates.rav,metalInfo.density))}</td></tr><tr><td>r_lin · 换算 g/(m²·a)</td><td>—</td><td>${fmt(calc.umToMass(rates.rlin,metalInfo.density))}</td></tr>`:''}</tbody></table></div><p class="ref-caption">Annex B 提供按腐蚀等级分类的指导速率范围。此处取区间上限；分段累计为本工具按两个阶段构建的计算结果。快速估算使用 r_lin × 年限，仅供比较。</p>`;
  return;
 }
 if(state.tab==='iso9223'){
  const title=`${metalInfo.name} · 首年腐蚀分级摘录`;
  const tr=data.categories.map((grade,i)=>{
   const massLo=i===0?null:metalInfo.massUpper[i-1],massHi=metalInfo.massUpper[i];
   const r=metalInfo.ranges[i];
   const massStr=metal==='aluminium'?(i===0?'可忽略':i===5?'> 10':i===1?'≤ 0.6':`> ${sig(massLo)} – ≤ ${sig(massHi)}`):(i===0?`≤ ${sig(massHi)}`:`> ${sig(massLo)} – ≤ ${sig(massHi)}`);
   const depthStr=!r?'—':metal==='aluminium'?'—':r[1]==null?'> '+sig(r[0]):i===0?'≤ '+sig(r[1]):`> ${sig(r[0])} – ≤ ${sig(r[1])}`;
   return `<tr><td>${grade}</td><td>${massStr}</td>${metal==='aluminium'?'':`<td>${depthStr}</td>`}</tr>`;
  }).join('');
  el.innerHTML=tabMeta(title,'ISO 9223:2012 · Table 2')+`<div class="table-scroll"><table class="reference-table"><thead><tr><th>腐蚀等级</th><th>质量损失 g/(m²·a)</th>${metal==='aluminium'?'':'<th>厚度损失 µm/a</th>'}</tr></thead><tbody>${tr}</tbody></table></div><p class="ref-caption">原表以质量损失和换算厚度列示，数值经舍入。铝仅提供质量损失分级；C1 为定性可忽略，CX 无有限上界。${metal==='aluminium'?'铝仅以质量损失表达；不将累计质量损失解释为点蚀深度。':''}</p>`;
 }
}
// The entire graph, table and Tooltip use calc.modelValue for numerical consistency.
const SVG_NS='http://www.w3.org/2000/svg';
function svgEl(name,attrs){const el=document.createElementNS(SVG_NS,name);for(const [key,val] of Object.entries(attrs||{}))el.setAttribute(key,String(val));return el;}
function line(svg,x1,y1,x2,y2,stroke,width=1,dash=''){svg.appendChild(svgEl('line',{x1,y1,x2,y2,stroke,'stroke-width':width,...(dash?{'stroke-dasharray':dash}:{})}));}
function label(svg,x,y,s,opt={}){const node=svgEl('text',{x,y,fill:opt.fill||'#9BA0A6','font-size':opt.size||10,'font-family':'Inter,Helvetica Neue,Arial,sans-serif','text-anchor':opt.anchor||'start','font-variant-numeric':'tabular-nums'});node.textContent=s;svg.appendChild(node);}
function drawChart(){
 const svg=$('chartSvg'),wrap=$('chartWrap'),r=state.current,input=currentInput();
 const w=Math.max(260,Math.round(wrap.clientWidth)),h=window.matchMedia('(max-width:425px)').matches?265:window.matchMedia('(max-width:900px)').matches?290:315;
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('height',h);svg.setAttribute('width',w);svg.replaceChildren();
 const pad={left:w<=360?38:46,right:10,top:12,bottom:28},left=pad.left,right=w-pad.right,top=pad.top,bottom=h-pad.bottom,plotH=bottom-top;
 const xMax=Math.max(20,input.years);state.chartMax=xMax;$('chartMaxYear').textContent=xMax;
 const visible=data.methods.filter(m=>state.visible.has(m.id));
 const peak=[];
 if(r?.valid)for(const m of visible){for(let y=0;y<=xMax;y+=0.5){const v=calc.modelValue(m.id,r.ctx,y);if(calc.finite(v))peak.push(m.id==='a'?displayedModel('a',r.ctx,y):outputLoss(v,input.metal));}}
 const rawMax=Math.max(1,...peak),stepCandidate=rawMax/4;const base=Math.pow(10,Math.floor(Math.log10(stepCandidate)));
 const steps=[1,2,2.5,5,10];const step=steps.find(k=>k*base>=stepCandidate)||10*base;
 const yMax=Math.ceil(rawMax/step)*step,px=t=>left+(t/xMax)*(right-left),py=v=>bottom-(v/yMax)*plotH;
 for(let j=0;j<=4;j++){const y=top+j*plotH/4;line(svg,left,y,right,y,'#EAECED',1);label(svg,left-8,y+3.5,fmt(yMax-j*yMax/4,yMax>=5?0:1),{anchor:'end',size:10});}
 line(svg,left,top,left,bottom,'#D8DCDD');line(svg,left,bottom,right,bottom,'#D8DCDD');
 const tickStep=xMax<=20?5:xMax<=30?10:10;
 for(let t=tickStep;t<=xMax;t+=tickStep){const x=px(t);line(svg,x,bottom,x,bottom+4,'#CFD2D5');label(svg,x,bottom+17,String(t),{anchor:'middle'});}
 if(r?.valid){
  for(const m of visible){let path='',started=false;
   const start=m.id==='a'?1:0,end=m.id==='a'?Math.min(xMax,20):xMax;
   const inc=m.id==='a'?0.125:0.25;
   for(let t=start;t<=end+1e-8;t+=inc){const v=calc.modelValue(m.id,r.ctx,Math.min(t,end));if(!calc.finite(v)){started=false;continue;}const out=displayedModel(m.id,r.ctx,Math.min(t,end));if(!calc.finite(out)){started=false;continue;}path+=(started?'L':'M')+px(Math.min(t,end)).toFixed(2)+','+py(out).toFixed(2)+' ';started=true;}
   if(path)svg.appendChild(svgEl('path',{d:path,fill:'none',stroke:m.color,'stroke-width':m.id==='b1'?2.6:2,'stroke-linejoin':'round','stroke-linecap':'round',...(m.dash?{'stroke-dasharray':m.dash}:{})}));
  }
  const hovered=state.hoverYear!==null?state.hoverYear:input.years;
  const cursorX=px(hovered);line(svg,cursorX,top,cursorX,bottom,'#BDC4C8',1.1,'3 4');
  for(const m of visible){const val=calc.modelValue(m.id,r.ctx,hovered);if(calc.finite(val))svg.appendChild(svgEl('circle',{cx:cursorX,cy:py(displayedModel(m.id,r.ctx,hovered)),r:m.id==='b1'?4:3,fill:'#fff',stroke:m.color,'stroke-width':2}));}
 }
 function displayTooltip(){
  const t=state.hoverYear,tip=$('chartTooltip');if(!r?.valid||t===null){tip.hidden=true;return;}
  tip.hidden=false;tip.innerHTML=`<div class="chart-tooltip-year">${t} YEARS <span style="float:right;color:#AAADB0;font-weight:400">${lossUnit(input.metal)}</span></div>`+visible.map(m=>{const v=calc.modelValue(m.id,r.ctx,t);return `<div class="chart-tooltip-row"><span class="t-label" style="--c:${m.color}">${m.id==='a'?annexLabel(r.ctx):m.name}</span><strong>${fmt(displayedModel(m.id,r.ctx,t))}</strong></div>`;}).join('');
  const tipWidth=tip.offsetWidth||178;
  tip.style.left=`${Math.max(4,Math.min(w-tipWidth-4,px(t)+12))}px`;
 }
 displayTooltip();
}
function setHoverFromPointer(event){
 const svg=$('chartSvg'),r=state.current;if(!r?.valid)return;
 const bounds=svg.getBoundingClientRect(),w=Math.max(260,Math.round($('chartWrap').clientWidth)),left=w<=360?38:46,right=w-10;
 const x=(event.clientX-bounds.left)*(w/bounds.width);
 state.hoverYear=Math.min(state.chartMax,Math.max(1,Math.round((x-left)/(right-left)*state.chartMax)));
 drawChart();
}
function exportCsv(){
 const r=state.current,input=currentInput();if(!r?.valid)return;
 const headers=['年限 (year)',...data.methods.map(m=>`${m.id==='a'?annexLabel(r.ctx):m.name} (${lossUnit(input.metal)})`)];
 const meta=[['材料',data.metals[input.metal].name],['模式',state.mode==='grade'?'已知腐蚀等级':'环境参数估算'],['腐蚀等级',r.grade||'超出分级'],[`首年腐蚀速率 (${rateUnit(input.metal)})`,sig(outputLoss(r.rate,input.metal))],['年限',input.years],['Annex A 数据类型',annexLabel(r.ctx)+'；超出20年留空'],['公式法 B1/B2','1–20年 Eq.(1); >20年 Eq.(3)']];
 const content=[...meta.map(row=>row.map(csvQuote).join(',')),'',headers.map(csvQuote).join(',')];
 for(let y=1;y<=input.years;y++)content.push([y,...data.methods.map(m=>{const v=displayedModel(m.id,r.ctx,y);return calc.finite(v)?v.toFixed(4):'';})].map(csvQuote).join(','));
 const blob=new Blob(['\uFEFF'+content.join('\r\n')],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`corrosion_${input.metal}_${r.grade||'unclassified'}_${input.years}y.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);status('CSV 已生成');
}
function csvQuote(s){return '"'+String(s).replace(/"/g,'""')+'"';}
let statusTimeout;
function status(message){clearTimeout(statusTimeout);$('actionStatus').textContent=message;statusTimeout=setTimeout(()=>$('actionStatus').textContent='',2700);}
async function copyResult(){
 const r=state.current,input=currentInput();if(!r?.valid)return;
 const lines=[`大气腐蚀计算结果 · 工程变量`, `材料：${data.metals[input.metal].name}`,`腐蚀等级：${r.grade||'超出范围'}`,`设计年限：${input.years} 年`,`首年速率：${fmt(outputLoss(r.rate,input.metal))} ${rateUnit(input.metal)}`, ...data.methods.map(m=>{const v=displayedModel(m.id,r.ctx,input.years);return `${m.id==='a'?annexLabel(r.ctx):m.name}：${fmt(v)}${calc.finite(v)?' '+lossUnit(input.metal):''}`;}),'ISO 9223:2012 / ISO 9224:2012','Annex B 快速估算为工具简化假设；缺失或不适用项目显示 —。'];
 try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(lines.join('\n'));else{const box=document.createElement('textarea');box.value=lines.join('\n');box.style.position='fixed';box.style.left='-9999px';document.body.append(box);box.select();if(!document.execCommand('copy'))throw Error('copy');box.remove();}status('结果已复制');}catch{status('复制未获浏览器授权，请使用 CSV 导出');}
}
function reset(){
 elements.metal.value='zinc';elements.resultUnit.value='depth';preferredResultUnit='depth';elements.category.value='C3';elements.rateChoice.value='upper';elements.customRate.value='2.1';elements.years.value='20';elements.temp.value='20';elements.rh.value='70';elements.so2Unit.value='deposition';elements.so2.value='10';elements.chloride.value='20';priorSO2Unit='deposition';state.mode='grade';state.hoverYear=null;state.pinTooltip=false;state.visible=new Set(data.methods.map(m=>m.id));state.tab='years';renderLegend();updateTabs();render();status('已恢复默认参数');
}
function updateTabs(){document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===state.tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});}
function init(){
 document.querySelectorAll('.mode-btn').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;state.hoverYear=null;render();}));
 document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;updateTabs();renderReference();}));
 document.querySelectorAll('input:not([type=checkbox]),select').forEach(el=>{
  el.addEventListener('input',()=>{if(el===elements.resultUnit&&elements.metal.value!=='aluminium')preferredResultUnit=el.value;state.hoverYear=null;state.pinTooltip=false;render();});el.addEventListener('change',()=>{if(el===elements.resultUnit&&elements.metal.value!=='aluminium')preferredResultUnit=el.value;state.hoverYear=null;render();});
 });
 preferredResultUnit=elements.resultUnit.value;
 elements.resultUnit.addEventListener('change',()=>{if(elements.metal.value!=='aluminium')preferredResultUnit=elements.resultUnit.value;});
 priorSO2Unit=elements.so2Unit.value;
 elements.so2Unit.addEventListener('change',()=>{
  const num=readNum(elements.so2);
  if(Number.isFinite(num)&&elements.so2Unit.value!==priorSO2Unit){
   elements.so2.value=sig(elements.so2Unit.value==='concentration'?num/0.8:num*0.8);
  }
  priorSO2Unit=elements.so2Unit.value;render();
 });
 $('resetBtn').addEventListener('click',reset);
 $('exportBtn').addEventListener('click',exportCsv);
 $('copyBtn').addEventListener('click',copyResult);
 const svg=$('chartSvg');
 svg.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||event.buttons||event.pointerType==='pen')setHoverFromPointer(event);});
 svg.addEventListener('pointerdown',event=>{state.pinTooltip=event.pointerType!=='mouse';setHoverFromPointer(event);});
 svg.addEventListener('pointerleave',()=>{if(!state.pinTooltip){state.hoverYear=null;drawChart();}});
 svg.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const current=state.hoverYear??currentInput().years;state.hoverYear=event.key==='Home'?1:event.key==='End'?state.chartMax:Math.min(state.chartMax,Math.max(1,current+(event.key==='ArrowRight'?1:-1)));drawChart();}});
 if('ResizeObserver'in window)new ResizeObserver(()=>drawChart()).observe($('chartWrap'));
 else window.addEventListener('resize',drawChart);
 renderLegend();render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
