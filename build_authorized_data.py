"""Pack a rights-cleared transcription of ISO 9224 Annex A into the public webpage.
No original ISO tables ship with this repository beyond explicitly labelled tiny excerpts.
Run ONLY after you have the copyright licence necessary to reproduce the dataset:
  python build_authorized_data.py filled.csv --rights-confirmed
Then run `python build.py` and deploy the rebuilt files.
"""
from pathlib import Path
import argparse, csv, json, math
parser=argparse.ArgumentParser()
parser.add_argument('csv_file',type=Path)
parser.add_argument('--rights-confirmed',action='store_true',help='Confirm you have permission to publish the supplied table entries')
args=parser.parse_args()
if not args.rights_confirmed:parser.error('Publishing ISO original table data requires permission; pass --rights-confirmed only when obtained.')
metals={'steel','zinc','copper','aluminium'}
categories={'C1','C2','C3','C4','C5','CX'}
years=['1','2','5','10','15','20']
data={}
with args.csv_file.open(encoding='utf-8-sig',newline='') as f:
 reader=csv.DictReader(f)
 if reader.fieldnames!=['metal','category','unit']+years:parser.error('CSV header must be: metal,category,unit,1,2,5,10,15,20')
 for n,row in enumerate(reader,2):
  metal,cat,unit=row['metal'],row['category'],row['unit']
  if metal not in metals or cat not in categories or unit not in ('g/m²','µm') or (metal=='aluminium' and unit!='g/m²'):
   parser.error(f'row {n}: metal/category/unit not accepted')
  vals=[row[k].strip() for k in years]
  if all(not v for v in vals):continue
  if any(not v for v in vals):parser.error(f'row {n}: all six nodes required or leave the entire row empty')
  try: arr=[float(v) for v in vals]
  except ValueError:parser.error(f'row {n}: nonnumeric value')
  if not all(math.isfinite(v) and v>=0 for v in arr) or any(a>b for a,b in zip(arr,arr[1:])):parser.error(f'row {n}: values must be finite, nonnegative, nondecreasing')
  key=f'{metal}:{cat}:{unit}'
  if key in data:parser.error(f'row {n}: duplicated {key}')
  data[key]={'table':'A.1' if unit=='g/m²' else 'A.2','unit':unit,'values':arr}
if not data:parser.error('No filled data rows.')
module='''/* Rights-cleared original ISO Annex A values, provided by the publisher.\n * Do not distribute this file unless the publisher's copyright permission covers it. */\n(function(root){\n 'use strict';\n Object.assign(root.CORR_DATA.annexA.licensedEntries, '''+json.dumps(data,ensure_ascii=False,separators=(',',':'))+''');\n})(typeof window!=='undefined'?window:globalThis);\n'''
Path('licensed-annex-a.js').write_text(module,encoding='utf-8')
print(f'Wrote licensed-annex-a.js with {len(data)} rows. Rebuild using: python build.py')
