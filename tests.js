const assert=require('node:assert/strict');
const d=require('./data.js');
const c=require('./calc.js');
const near=(a,b,tol=0.015)=>assert.ok(Math.abs(a-b)<=tol,`Expected ${a} ≈ ${b}`);
const env={T:20,RH:70,Pd:10,Sd:20};
const input={mode:'grade',metal:'zinc',category:'C3',choice:'upper',custom:0,years:20,env};
let r=c.evaluate(input);
near(r.rate,2.1,1e-8);
near(r.values.b1,23.99);
near(r.values.b2,28.71);
near(r.values.a,24,1e-9);
near(r.values.b,25,1e-9);
near(r.values.quick,22,1e-9);
assert.equal(c.annexALoss('zinc','C3',21),null);
assert.equal(c.annexALoss('zinc','C3',50),null);
near(c.annexALoss('zinc','C3',12.5),16.3,1e-9);
near(c.annexALoss('zinc','C3',3.5),5.75,1e-9);
near(c.annexALoss('zinc','C4',20),48,1e-9); // user-supplied A.2 reference
assert.equal(c.annexASeries('zinc','C4','µm').source,'original');
assert.equal(c.annexASeries('zinc','C3','µm').source,'original');
assert.equal(c.annexASeries('zinc','C3','g/m²').source,'original');
near(c.annexAValue('steel','C3',20,'g/m²'),1916,1e-8); // original mass table, NOT 240*7.85
assert.notEqual(c.annexAValue('steel','C3',20,'g/m²'),c.annexAValue('steel','C3',20,'µm')*7.85);
near(c.outputValue('a',{metal:'zinc',category:'C3',r:2.1},20,'g/m²'),171,1e-8);
assert.equal(c.annexBRates('aluminium','C3'),null);
assert.equal(c.firstYearRange('aluminium','C1'),null);
assert.equal(c.selectedR('aluminium','CX','upper',0),null);
near(c.massToUm(2,2.7),2/2.7,1e-9);
assert.equal(c.gradeFromRate('zinc',2.1),'C3');
assert.equal(c.gradeFromRate('zinc',2.101),'C4');
assert.equal(c.gradeFromRate('zinc',26),null);
assert.equal(c.gradeFromRate('aluminium',c.massToUm(2,2.7)),'C3');
assert.equal(c.gradeFromRate('aluminium',c.massToUm(11,2.7)),'CX');
assert.ok(c.doseResponse('steel',env)>0);
assert.ok(c.doseResponse('zinc',env)>0);
assert.ok(c.doseResponse('copper',env)>0);
assert.ok(c.doseResponse('aluminium',env)>0);
near(c.doseResponse('steel',env),c.doseResponse('steel',{...env,T:20}),1e-9);
assert.deepEqual(c.outsideModelRange({T:-20,RH:95,Pd:0.5,Sd:800}),['T','RH','Pd','Sd']);
assert.equal(c.doseResponse('zinc',{T:20,RH:101,Pd:10,Sd:20}),null);
assert.equal(c.doseResponse('zinc',{T:20,RH:70,Pd:-1,Sd:20}),null);
const envResult=c.evaluate({...input,mode:'env'});
assert.equal(envResult.grade,c.gradeFromRate('zinc',c.doseResponse('zinc',env)));
const envValue=c.modelValue('b1',envResult.ctx,20);
near(envResult.values.b1,envValue,1e-10);
// All chart, tooltip and tab values are provided by this same modelValue function.
console.log('PASS: 30+ numeric, boundary, interpolation, unavailable-data, and consistency checks');
// ISO 9224:2012 Eq. (3): t > 20 years, the tangent to Eq. (1) at 20 years.
for(const metal of ['steel','zinc','copper','aluminium']){
 for(const method of ['b1','b2']){
  const b=d.metals[metal][method],rate=1.8;
  const ctx={metal,category:'C3',r:rate};
  const at20=rate*Math.pow(20,b);
  const slope=rate*b*Math.pow(20,b-1);
  near(c.modelValue(method,ctx,20),at20,1e-10);
  near(c.modelValue(method,ctx,21),at20+slope,1e-10);
  near(c.modelValue(method,ctx,40),at20+20*slope,1e-10);
  near(c.modelValue(method,ctx,50),at20+30*slope,1e-10);
  near(c.modelValue(method,ctx,20+1e-8),at20+1e-8*slope,1e-8);
  // Eq. (3) yields larger long-term estimates than the power law for 0 < b < 1.
  assert.ok(c.modelValue(method,ctx,40)>rate*Math.pow(40,b));
 }
}
const zn40=c.evaluate({...input,years:40});
near(zn40.values.b1,2.1*(Math.pow(20,0.813)+.813*Math.pow(20,-.187)*20),1e-10);
near(zn40.values.b2,2.1*(Math.pow(20,0.873)+.873*Math.pow(20,-.127)*20),1e-10);
const al20=c.evaluate({...input,metal:'aluminium'});
near(c.umToMass(al20.values.b1,d.metals.aluminium.density),2*Math.pow(20,.728),1e-9);
near(c.umToMass(al20.values.a,d.metals.aluminium.density),18,1e-9);
console.log('PASS: ISO 9224 Eq. (3) continuity, long-term slopes, and aluminium mass units');

// A.1 and A.2 are independent original screenshot transcriptions, not conversions.
for(const metal of ['steel','zinc','copper','aluminium']){
 for(const cat of d.categories){
  for(const unit of (metal==='aluminium'?['g/m²']:['g/m²','µm'])){
   const series=c.annexASeries(metal,cat,unit), key=`${metal}:${cat}:${unit}`;
   const entry=d.annexA.entries[key];
   if(!entry){assert.equal(series,null);continue;}
   assert.equal(series.source,'original');
   assert.deepEqual(series.values,entry.values);
   for(let j=0;j<d.annexA.years.length;j++){
    near(c.annexAValue(metal,cat,d.annexA.years[j],unit),entry.values[j],1e-9);
   }
   const v=c.annexAValue(metal,cat,3,unit);
   near(v,entry.values[1]+(entry.values[2]-entry.values[1])/3,1e-9);
   assert.equal(c.annexAValue(metal,cat,21,unit),null);
  }
 }
}
assert.equal(c.annexASeries('aluminium','C1','g/m²'),null);
assert.equal(c.annexASeries('aluminium','CX','g/m²'),null);
// User-supplied A.1 screenshot notable cells; retain verbatim, flag for source review.
near(c.annexAValue('copper','C2',5,'g/m²'),20,1e-9);
near(c.annexAValue('zinc','C5',20,'g/m²'),625,1e-9);
// Authorized original input is isolated by unit, validated, and uses interpolation.
const valid='metal,category,unit,1,2,5,10,15,20\nsteel,C4,g/m²,650,900,1500,2200,3000,3600\n';
assert.equal(c.parseLicensedCsv(valid).ok,true);
assert.equal(c.parseLicensedCsv('metal,category,unit,1,2,5,10,15,20\nsteel,C4,g/m²,650,900,-1,2200,3000,3600').ok,false);
assert.equal(c.parseLicensedCsv('metal,category,unit,1,2,5,10,15,20\nsteel,C4,g/m²,650,900,1500,1400,3000,3600').ok,false);
assert.equal(c.parseLicensedCsv('metal,category,unit,1,2,5,10,15,20\naluminium,C4,µm,1,2,3,4,5,6').ok,false);
const before=c.annexASeries('steel','C4','g/m²');assert.equal(before.source,'original');
assert.equal(c.loadLicensedCsv(valid).ok,true);
assert.equal(c.annexASeries('steel','C4','g/m²').source,'original');
assert.equal(c.annexAValue('steel','C4',7.5,'g/m²'),1850);
assert.equal(c.annexASeries('steel','C4','µm').source,'original');
console.log('PASS: 40 screenshot rows, independent mass and thickness data, CSV override');
// Blank template rows may be kept when only selected licensed rows are populated.
assert.equal(c.parseLicensedCsv('metal,category,unit,1,2,5,10,15,20\nsteel,C1,µm,,,,,,\nsteel,C4,g/m²,650,900,1500,2200,3000,3600\n').ok,true);
