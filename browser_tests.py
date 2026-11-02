from pathlib import Path
from playwright.sync_api import sync_playwright
from math import isclose
p=Path(__file__).parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1180,'height':900},device_scale_factor=1,accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((p/'standalone.html').read_text(),wait_until='load')
    page.wait_for_selector('.legend-item input[type=checkbox]')
    assert page.locator('#heroValue').inner_text()=='23.99',page.locator('#heroValue').inner_text()
    assert page.locator('#heroUnit').inner_text()=='µm'
    assert page.locator('.legend-item input').count()==5
    assert page.locator('.legend-item input:checked').count()==5
    page.screenshot(path=str(p/'preview_1180_v2.png'),full_page=True)
    # t > 20, Eq 3; chart/table dynamic data
    page.locator('#years').fill('40')
    page.locator('#years').dispatch_event('input')
    result=page.evaluate('''() => window.CORR_CALC.evaluate({mode:'grade',metal:'zinc',category:'C3',choice:'upper',custom:0,years:40,env:{T:20,RH:70,Pd:10,Sd:20}}).values.b1''')
    assert page.locator('#heroValue').inner_text()==f'{result:.2f}',(page.locator('#heroValue').inner_text(),result)
    assert result>2.1*40**0.813
    assert page.locator('#compareBody tr:first-child td:nth-child(2)').inner_text()==f'{result:.2f}'
    assert page.locator('#chartNote').count()==0
    assert page.locator('#annexAFile').count()==0
    assert page.locator('.table-caption').count()==0
    # CSV unit and long-term value
    with page.expect_download() as dl:
        page.locator('#exportBtn').click()
    csv=dl.value.path().read_text(encoding='utf-8-sig')
    assert '公式法 B1 (µm)' in csv and '40' in csv
    # output mass: keep same physical corrosion, but change unit
    page.locator('#resultUnit').select_option('mass')
    assert page.locator('#heroUnit').inner_text()=='g/m²'
    assert isclose(float(page.locator('#heroValue').inner_text()),result*7.14,abs_tol=0.006)
    assert 'g/(m²·a)' in page.locator('#firstYear').inner_text()
    assert page.locator('#compareUnit').inner_text()=='UNIT / g/m²'
    assert 'g/m²' in page.locator('#referenceContent .ref-meta').inner_text()
    with page.expect_download() as dl:
        page.locator('#exportBtn').click()
    csv=dl.value.path().read_text(encoding='utf-8-sig')
    assert '公式法 B1 (g/m²)' in csv and 'g/(m²·a)' in csv
    # Toggle curves with visually present native checkbox
    first=page.locator('.legend-item input').first
    first.uncheck(force=False)
    assert page.locator('#chartSvg path[stroke="#FF6000"]').count()==0
    assert page.locator('.legend-item input:checked').count()==4
    first.check(force=False)
    assert page.locator('#chartSvg path[stroke="#FF6000"]').count()==1
    # switch to Aluminium, mass only; ISO 9223 no thickness column; Annex A only mass
    page.locator('#metal').select_option('aluminium')
    assert page.locator('#resultUnit').is_disabled()
    assert page.locator('#resultUnit').input_value()=='mass'
    assert page.locator('#heroUnit').inner_text()=='g/m²'
    assert 'g/(m²·a)' in page.locator('#firstYear').inner_text()
    page.locator('button[data-tab="annexA"]').click()
    assert 'g/m²' in page.locator('#referenceContent').inner_text()
    assert 'µm' not in page.locator('#referenceContent').inner_text()
    page.locator('button[data-tab="iso9223"]').click()
    assert 'µm' not in page.locator('#referenceContent').inner_text()
    # Switch back: preferred output restored
    page.locator('#metal').select_option('zinc')
    assert page.locator('#resultUnit').input_value()=='mass'
    # test C3 20 defaults restored
    page.locator('#resetBtn').click()
    assert page.locator('#resultUnit').input_value()=='depth'
    assert page.locator('#heroValue').inner_text()=='23.99'
    # Tooltip matches model comparison, down to 2 decimal places
    page.locator('#chartSvg').hover(position={'x':200,'y':110})
    assert page.locator('#chartTooltip').is_visible()
    val=page.locator('#chartTooltip .chart-tooltip-row').first.locator('strong').inner_text()
    t=int(page.locator('#chartTooltip .chart-tooltip-year').inner_text().split()[0])
    expected=page.evaluate('(t)=>window.CORR_CALC.modelValue("b1",{metal:"zinc",category:"C3",r:2.1},t)',t)
    assert val==f'{expected:.2f}',(val,t,expected)
    # Mobile and tablets: avoid horizontal overflow and overlapping hero
    for w in [375,320,425,768,1180]:
        page.set_viewport_size({'width':w,'height':850})
        page.wait_for_timeout(90)
        metrics=page.evaluate('''() => ({scroll:document.documentElement.scrollWidth,inner:innerWidth,
         hero:(()=>{const a=document.querySelector('.hero-left').getBoundingClientRect(),b=document.querySelector('.hero-secondary').getBoundingClientRect();return {left:a.right,right:b.left,overlap:a.right>b.left+1&&a.top<b.bottom&&b.top<a.bottom}})()})''')
        assert metrics['scroll']<=w+1,(w,metrics)
        assert not metrics['hero']['overlap'],(w,metrics)
        if w==375:
            page.screenshot(path=str(p/'preview_375_v2.png'),full_page=True)
        if w==768:
            page.screenshot(path=str(p/'preview_768_v2.png'),full_page=True)
    # Annex A original nodes from user-provided screenshots are present in all numeric grades.
    page.locator('#category').select_option('C4')
    page.locator('button[data-tab="annexA"]').click()
    assert '参考数值' in page.locator('#referenceContent').inner_text()
    assert '原始数据' not in page.locator('#referenceContent').inner_text()
    assert '节点录入' not in page.locator('#referenceContent').inner_text()
    assert '查表法' in page.locator('#compareBody').inner_text()
    page.locator('#resultUnit').select_option('mass')
    assert 'g/m²' in page.locator('#referenceContent').inner_text()
    assert '覆盖 Annex A' not in page.locator('.reference-panel').inner_text()
    page.locator('#years').fill('21')
    page.locator('#years').dispatch_event('input')
    assert page.locator('#compareBody tr:nth-child(3) td:nth-child(2)').inner_text()=='—'
    assert not errors,errors
    browser.close()
print('BROWSER PASS: Eq.3, unit switch, Aluminium-only mass, CSV, tooltip, legend toggles, 320/375/425/768/1180 layout')
