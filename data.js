/* Engineering Variables · Standards data / user-supplied reference excerpts
 * ISO 9223:2012 Table 2 and Clause 8.2; ISO 9224:2012 Table 2,
 * Annex A (reference nodes transcribed from user-provided screenshots), Annex B Table B.1 (interval upper bounds).
 * Copyright: user-supplied images do not automatically grant public redistribution rights.
 * ISO 9224 Annex A data are category reference values and are not fitted to a custom r_corr.
 * ISO 9224 Equation (3) is implemented separately in calc.js for t > 20 years.
 */
(function(root){
'use strict';
const categories=['C1','C2','C3','C4','C5','CX'];
const metals={
  steel: {name:'碳钢',en:'Carbon steel', density:7.85, b1:0.523,b2:0.575,
    unit:'µm/a', ranges:[[0,1.3],[1.3,25],[25,50],[50,80],[80,200],[200,700]],
    massUpper:[10,200,400,650,1500,5500],
    annexB:{rav:[0.4,8.3,17,27,67,233],rlin:[0.3,4.9,10,16,39,138]}},
  zinc: {name:'锌',en:'Zinc',density:7.14,b1:0.813,b2:0.873,
    unit:'µm/a',ranges:[[0,0.1],[0.1,0.7],[0.7,2.1],[2.1,4.2],[4.2,8.4],[8.4,25]],
    massUpper:[0.7,5,15,30,60,180],
    annexB:{rav:[0.07,0.5,1.4,2.7,5.5,16],rlin:[0.05,0.4,1.1,2.2,4.4,13]}},
  copper: {name:'铜',en:'Copper',density:8.96,b1:0.667,b2:0.726,
    unit:'µm/a',ranges:[[0,0.1],[0.1,0.6],[0.6,1.3],[1.3,2.8],[2.8,5.6],[5.6,10]],
    massUpper:[0.9,5,12,25,50,90],
    annexB:{rav:[0.05,0.3,0.6,1.3,2.6,4.6],rlin:[0.03,0.2,0.4,0.9,1.8,3.2]}},
  aluminium: {name:'铝',en:'Aluminium',density:2.70,b1:0.728,b2:0.807,
    unit:'g/(m²·a)',
    // ISO 9223 Table 2 reports aluminium in mass units, not penetration depth.
    // C1: 'negligible', not a numeric interval; CX: open-ended (>10 g/m²/a).
    ranges:[null,[0,0.6],[0.6,2],[2,5],[5,10],[10,null]],
    massUpper:[null,0.6,2,5,10,null], annexB:null}
};
const annexA={
  years:[1,2,5,10,15,20],
  // Transcribed exclusively from the two screenshots supplied by the user.
  // Data provenance does not itself constitute a republication license.
  // Keep A.1 mass values and A.2 thickness values independent.
  provenance:'user-provided ISO 9224:2012 Annex A screenshots',
  licenseStatus:'unconfirmed',
  nonNumeric:{'aluminium:C1':'可忽略（Negligible）','aluminium:CX':'一般腐蚀数据可能具有误导性'},
  licensedEntries:{},
  entries:{
    "steel:C1:g/m²":{"table":"A.1","unit":"g/m²","values":[10,14,23,33,41,48]},
    "steel:C2:g/m²":{"table":"A.1","unit":"g/m²","values":[200,287,464,668,824,958]},
    "steel:C3:g/m²":{"table":"A.1","unit":"g/m²","values":[400,575,928,1334,1649,1916]},
    "steel:C4:g/m²":{"table":"A.1","unit":"g/m²","values":[650,934,1508,2167,2679,3114]},
    "steel:C5:g/m²":{"table":"A.1","unit":"g/m²","values":[1500,2155,3480,5001,6183,7186]},
    "steel:CX:g/m²":{"table":"A.1","unit":"g/m²","values":[5500,7904,12760,18337,22671,26390]},
    "zinc:C1:g/m²":{"table":"A.1","unit":"g/m²","values":[0.7,1.2,2.6,4.6,6.3,8]},
    "zinc:C2:g/m²":{"table":"A.1","unit":"g/m²","values":[5,9,18,32,45,57]},
    "zinc:C3:g/m²":{"table":"A.1","unit":"g/m²","values":[15,26,56,97,136,171]},
    "zinc:C4:g/m²":{"table":"A.1","unit":"g/m²","values":[30,53,111,195,271,343]},
    "zinc:C5:g/m²":{"table":"A.1","unit":"g/m²","values":[60,105,222,390,542,625]},
    "zinc:CX:g/m²":{"table":"A.1","unit":"g/m²","values":[180,316,666,1170,1627,2056]},
    "copper:C1:g/m²":{"table":"A.1","unit":"g/m²","values":[0.9,1.4,2.6,4.2,5.5,6.6]},
    "copper:C2:g/m²":{"table":"A.1","unit":"g/m²","values":[5,8,20,23,30,37]},
    "copper:C3:g/m²":{"table":"A.1","unit":"g/m²","values":[12,19,35,56,73,88]},
    "copper:C4:g/m²":{"table":"A.1","unit":"g/m²","values":[25,40,73,116,152,184]},
    "copper:C5:g/m²":{"table":"A.1","unit":"g/m²","values":[50,79,146,232,304,368]},
    "copper:CX:g/m²":{"table":"A.1","unit":"g/m²","values":[90,143,263,418,548,664]},
    "aluminium:C2:g/m²":{"table":"A.1","unit":"g/m²","values":[0.6,1,1.9,3.2,4.4,5.3]},
    "aluminium:C3:g/m²":{"table":"A.1","unit":"g/m²","values":[2,3,6,11,14,18]},
    "aluminium:C4:g/m²":{"table":"A.1","unit":"g/m²","values":[5,8,16,28,36,44]},
    "aluminium:C5:g/m²":{"table":"A.1","unit":"g/m²","values":[10,17,32,54,72,88]},
    "steel:C1:µm":{"table":"A.2","unit":"µm","values":[1.3,1.9,3,4.3,5.4,6.2]},
    "steel:C2:µm":{"table":"A.2","unit":"µm","values":[25,36,58,83,103,120]},
    "steel:C3:µm":{"table":"A.2","unit":"µm","values":[50,72,116,167,206,240]},
    "steel:C4:µm":{"table":"A.2","unit":"µm","values":[80,115,186,267,330,383]},
    "steel:C5:µm":{"table":"A.2","unit":"µm","values":[200,287,464,667,824,958]},
    "steel:CX:µm":{"table":"A.2","unit":"µm","values":[700,1006,1624,2334,2885,3354]},
    "zinc:C1:µm":{"table":"A.2","unit":"µm","values":[0.1,0.2,0.4,0.6,0.9,1.1]},
    "zinc:C2:µm":{"table":"A.2","unit":"µm","values":[0.7,1.2,2.6,4.5,6.3,8]},
    "zinc:C3:µm":{"table":"A.2","unit":"µm","values":[2.1,3.7,7.8,13.6,19,24]},
    "zinc:C4:µm":{"table":"A.2","unit":"µm","values":[4.2,7.4,15.5,27.3,38,48]},
    "zinc:C5:µm":{"table":"A.2","unit":"µm","values":[8.4,14.3,31.1,54.6,75.9,95.9]},
    "zinc:CX:µm":{"table":"A.2","unit":"µm","values":[25,44,93,162,226,286]},
    "copper:C1:µm":{"table":"A.2","unit":"µm","values":[0.1,0.2,0.3,0.5,0.6,0.7]},
    "copper:C2:µm":{"table":"A.2","unit":"µm","values":[0.6,1,1.8,2.8,3.6,4.4]},
    "copper:C3:µm":{"table":"A.2","unit":"µm","values":[1.3,2.1,3.8,6,7.9,9.6]},
    "copper:C4:µm":{"table":"A.2","unit":"µm","values":[2.8,4.4,8.2,13,17,20.6]},
    "copper:C5:µm":{"table":"A.2","unit":"µm","values":[5.6,8.9,16.4,26,34.1,41.3]},
    "copper:CX:µm":{"table":"A.2","unit":"µm","values":[10,16,29,46,61,74]}
  }
};
const envRanges={T:[-17.1,28.7],RH:[34,93],Pd:[0.7,150.4],Sd:[0.4,760.5]};
const methods=[
 {id:'b1',name:'公式法 B1',description:'平均时间指数',use:'常规估算',color:'#FF6000',dash:''},
 {id:'b2',name:'公式法 B2',description:'保守时间指数',use:'保守校核',color:'#617B8C',dash:'7 4'},
 {id:'a',name:'Annex A 查表法',description:'附录参考节点',use:'快速查表',color:'#4E857A',dash:''},
 {id:'b',name:'Annex B 分段计算法',description:'两阶段指导速率',use:'长期估算',color:'#AA874F',dash:'9 4'},
 {id:'quick',name:'Annex B 快速估算法',description:'恒定稳态速率',use:'快速比较',color:'#987A9B',dash:'2 4'}
];
const sources={
 iso9223:'https://www.iso.org/standard/53499.html',
 iso9224:'https://www.iso.org/standard/53500.html',
 limits:'https://standards.iteh.ai/catalog/standards/iso/ed08cea3-78ec-43e6-a8b7-7797ac5153e5/iso-9224-2012'
};
const data={categories,metals,annexA,envRanges,methods,sources};
root.CORR_DATA=data;
if(typeof module!=='undefined'&&module.exports)module.exports=data;
})(typeof window!=='undefined'?window:globalThis);
