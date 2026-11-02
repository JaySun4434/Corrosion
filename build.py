from pathlib import Path
import re, zipfile
p=Path(__file__).parent
html=(p/'index.html').read_text()
css=(p/'styles.css').read_text()
html=html.replace('<link rel="stylesheet" href="styles.css" />','<style>\n'+css+'\n</style>')
scripts=[]
for name in ('data.js','licensed-annex-a.js','calc.js','app.js'):
    html=html.replace(f'<script defer src="{name}"></script>','')
    scripts.append('<script>\n'+(p/name).read_text()+'\n</script>')
html=html.replace('</body>', '\n'.join(scripts)+'\n</body>')
(p/'standalone.html').write_text(html,encoding='utf-8')
with zipfile.ZipFile('/mnt/data/atmospheric-corrosion-calculator-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in ['index.html','styles.css','data.js','licensed-annex-a.js','calc.js','app.js','annex_a_authorized_template.csv','annex_a_transcribed_reference.csv','build_authorized_data.py','tests.js','browser_tests.py','build.py','README.md']:
        z.write(p/name,name)
print('standalone bytes',len(html.encode()),'zip bytes',(Path('/mnt/data/atmospheric-corrosion-calculator-source.zip')).stat().st_size)
