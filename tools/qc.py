"""QC อัตโนมัติสำหรับสื่อ AR — รัน: python3 tools/qc.py <โฟลเดอร์เว็บ> <โฟลเดอร์ผลลัพธ์> [ชื่อรอบ]
ตรวจ: การแสดงผล 3 ขนาดจอ x 11 ฉาก, ปุ่ม, ไฟล์เสียง, ข้อผิดพลาด, ความสอดคล้องของเนื้อหา
"""
import asyncio, subprocess, time, sys, os, json, re
from playwright.async_api import async_playwright

ROOT, OUT = sys.argv[1], sys.argv[2]
ROUND = sys.argv[3] if len(sys.argv) > 3 else 'round'
PORT = '8790'
VIEWPORTS = [('small', 360, 640), ('standard', 390, 844), ('large', 430, 932)]
SCENES = [('t1', 0, 'รู้จักโรค'), ('t1', 1, 'กินพอดี'), ('t1', 2, 'ขยับร่างกาย'), ('t1', 3, 'กินยาตามสั่ง'), ('t1', 4, 'ดูแลใจ'),
          ('t2', 0, 'ไตเสื่อมจากอะไร'), ('t2', 1, 'ค่า eGFR'), ('t2', 2, '10 วิธีดูแลไต'),
          ('t3', 0, 'สิ่งที่ทำประจำ'), ('t3', 1, '6 ขั้นตอน'), ('t3', 2, 'ครอบครัวช่วยได้')]
SAMPLE_CAPTION = 'หรือใช้ยาแก้ปวดและสมุนไพรบางชนิดไม่เหมาะสม มีโอกาสทำให้ไตเสื่อมเร็วขึ้นค่ะ'  # worst-case subtitle chunk (74 chars)

DOM_CHECK = r"""(() => {
  const W = innerWidth, H = innerHeight, out = [];
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' };
  const sel = ['.tab', '#shTitle', '#chap', '#capTxt', '.hudbtn', '#grabTxt', '.pbtn'];
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect(); const name = (el.textContent || el.getAttribute('aria-label') || s).trim().slice(0, 40);
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) out.push({ sev: 'FAIL', what: 'ข้อความล้นกรอบ', item: name });
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push({ sev: 'FAIL', what: 'อยู่นอกจอ', item: name });
  }
  const top = document.getElementById('topbar').getBoundingClientRect().bottom, chap = document.getElementById('chap'), chapB = chap && vis(chap) ? chap.getBoundingClientRect().bottom : top;
  const sheetTop = document.getElementById('sheet').getBoundingClientRect().top;
  const cap = document.getElementById('capTxt'); const capR = cap && vis(cap) ? cap.getBoundingClientRect() : null;
  const lines = capR ? Math.round(capR.height / parseFloat(getComputedStyle(cap).lineHeight || 24)) : 0;
  if (lines > 3) out.push({ sev: 'WARN', what: 'คำบรรยายยาวเกิน 3 บรรทัด', item: cap.textContent.slice(0, 40) });
  return { issues: out, frame: { W, H, top: chapB, sheetTop, capTop: capR ? capR.top : sheetTop } };
})()"""

def rect_issues(rects, frame):
    out = []
    if not rects: return out
    W, top, capTop = frame['W'], frame['top'], frame['capTop']
    L = [l for l in rects['labels'] if (l['text'] or '').strip()]
    for l in L:
        if l['x0'] < 2 or l['x1'] > W - 2: out.append({'sev': 'FAIL', 'what': 'ป้ายหลุดขอบจอ (ซ้าย/ขวา)', 'item': l['text']})
        elif l['y0'] < top - 4 or l['y1'] > capTop + 4: out.append({'sev': 'FAIL', 'what': 'ป้ายชนแถบด้านบนหรือคำบรรยาย', 'item': l['text']})
    for i in range(len(L)):
        for j in range(i + 1, len(L)):
            a, b = L[i], L[j]
            ix = max(0, min(a['x1'], b['x1']) - max(a['x0'], b['x0'])); iy = max(0, min(a['y1'], b['y1']) - max(a['y0'], b['y0']))
            sa = (a['x1'] - a['x0']) * (a['y1'] - a['y0']); sb = (b['x1'] - b['x0']) * (b['y1'] - b['y0'])
            if ix * iy > .12 * min(sa, sb): out.append({'sev': 'FAIL', 'what': 'ป้ายซ้อนกัน', 'item': f"{a['text']} / {b['text']}"})
    m = rects.get('model')
    if m:
        if m['x0'] < -4 or m['x1'] > W + 4: out.append({'sev': 'FAIL', 'what': 'โมเดลล้นขอบจอ', 'item': 'model'})
        if m['y0'] < top - 8: out.append({'sev': 'FAIL', 'what': 'โมเดลชนแถบด้านบน', 'item': 'model'})
        if m['y1'] > capTop + 24: out.append({'sev': 'WARN', 'what': 'คำบรรยายบังฐานโมเดล', 'item': 'model'})
    return out

async def run():
    os.makedirs(OUT, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', PORT, '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    report = {'round': ROUND, 'display': [], 'functions': [], 'files': {}, 'errors': [], 'content': []}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
            for vname, W, H in VIEWPORTS:
                pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
                pg.on('pageerror', lambda e: report['errors'].append(str(e)[:300]))
                pg.on('console', lambda m: report['errors'].append('console: ' + m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
                pg.on('response', lambda r: report['errors'].append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'exercise.mp4' not in r.url and 'fonts.g' not in r.url else None)
                await pg.route('**/fonts.g*/**', lambda r: r.abort())
                await pg.goto(f'http://127.0.0.1:{PORT}/'); await pg.wait_for_timeout(1000)
                if vname == 'standard': await pg.screenshot(path=f'{OUT}/{vname}_00_start.png')
                await pg.click('#noCam'); await pg.wait_for_timeout(300)
                last = None
                for tid, ti, name in SCENES:
                    if tid != last:
                        await pg.evaluate(f"document.getElementById('picker').hidden=true;__AR.openTopic('{tid}','float')"); await pg.wait_for_timeout(500)
                        if not await pg.evaluate('__AR.P.muted'): await pg.click('#mute')
                        last = tid
                    await pg.click(f'.tab[data-tab="{ti}"]'); await pg.wait_for_timeout(6500)
                    await pg.evaluate(f"document.getElementById('capTxt').textContent={json.dumps(SAMPLE_CAPTION)};__AR.G.qcSettle()"); await pg.wait_for_timeout(2500)
                    dom = await pg.evaluate(DOM_CHECK); rects = await pg.evaluate('__AR.G.qcRects()')
                    issues = dom['issues'] + rect_issues(rects, dom['frame'])
                    shot = f'{vname}_{tid}_{ti}.png'; await pg.screenshot(path=f'{OUT}/{shot}')
                    report['display'].append({'viewport': vname, 'scene': f'{tid}_{ti}', 'name': name, 'issues': issues, 'shot': shot})
                    # open the reading sheet once per scene on the standard phone and check the body text too
                    if vname == 'standard':
                        await pg.click('#grab'); await pg.wait_for_timeout(500)
                        body = await pg.evaluate("(()=>{const b=document.getElementById('shBody');const o=[];b.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&e.children.length===0&&(e.scrollWidth>e.clientWidth+1||r.right>innerWidth+1))o.push((e.textContent||'').slice(0,40))});return o})()")
                        for t in body: report['display'][-1]['issues'].append({'sev': 'FAIL', 'what': 'ข้อความในแผงอ่านล้น', 'item': t})
                        await pg.screenshot(path=f'{OUT}/{vname}_{tid}_{ti}_sheet.png'); await pg.click('#grab'); await pg.wait_for_timeout(300)
                if vname == 'standard':
                    # functions: every button group changes state
                    async def check(label, setup, action, expect):
                        await pg.evaluate(setup); await pg.wait_for_timeout(700)
                        await pg.evaluate(action); await pg.wait_for_timeout(600)
                        ok = await pg.evaluate(expect); report['functions'].append({'name': label, 'ok': bool(ok)})
                    await check('ปุ่มไตปกติ/ไตจากเบาหวาน', "__AR.openTopic('t2','float')", "document.querySelector('.tab[data-tab=\"0\"]').click();setTimeout(()=>document.querySelector('[data-k=\"1\"]').click(),300)", "new Promise(r=>setTimeout(()=>r(__AR.S.k===1&&document.querySelector('[data-k=\"1\"]').getAttribute('aria-pressed')==='true'),500))")
                    await check('แถบเลื่อนค่า eGFR', "document.querySelector('.tab[data-tab=\"1\"]').click()", "(()=>{const r=document.getElementById('gfr');r.value=30;r.dispatchEvent(new Event('input'))})()", "__AR.S.gfr===30&&/G3b/.test(document.getElementById('gfrS').textContent)")
                    await check('ปุ่มเลข 1–10 วิธีดูแลไต', "document.querySelector('.tab[data-tab=\"2\"]').click()", "setTimeout(()=>document.querySelector('[data-c=\"6\"]').click(),300)", "new Promise(r=>setTimeout(()=>r(__AR.S.care===6&&document.querySelector('[data-c=\"6\"]').getAttribute('aria-pressed')==='true'),500))")
                    await check('ปุ่มสิ่งที่ทำประจำ 6 ข้อ', "__AR.openTopic('t3','float')", "setTimeout(()=>document.querySelector('[data-r=\"4\"]').click(),300)", "new Promise(r=>setTimeout(()=>r(__AR.S.rt===4&&document.querySelector('[data-r=\"4\"]').getAttribute('aria-pressed')==='true'),500))")
                    await check('ปุ่ม 6 ขั้นตอน', "document.querySelector('.tab[data-tab=\"1\"]').click()", "setTimeout(()=>document.querySelector('[data-s=\"2\"]').click(),300)", "new Promise(r=>setTimeout(()=>r(__AR.S.step===2&&document.querySelector('[data-s=\"2\"]').getAttribute('aria-pressed')==='true'),500))")
                    await check('ปุ่มพูดแบบตำหนิ/ให้กำลังใจ', "document.querySelector('.tab[data-tab=\"2\"]').click()", "setTimeout(()=>document.querySelector('[data-t=\"bad\"]').click(),300)", "new Promise(r=>setTimeout(()=>r(__AR.S.talk==='bad'&&document.querySelector('[data-t=\"bad\"]').getAttribute('aria-pressed')==='true'),500))")
                    await check('ปุ่มดูวิดีโอออกกำลังกาย', "__AR.openTopic('t1','float');setTimeout(()=>document.querySelector('.tab[data-tab=\"2\"]').click(),200)", "setTimeout(()=>document.getElementById('openVid').click(),400)", "new Promise(r=>setTimeout(()=>r(__AR.VID.on===true||!document.getElementById('realVid').hidden),1500))")
                    await pg.evaluate("document.getElementById('vClose').click()")
                    if await pg.evaluate('__AR.P.muted'): await pg.click('#mute')
                    await check('เสียงบรรยายเล่นได้', "__AR.openTopic('t1','float')", "1", "new Promise(r=>setTimeout(()=>r(!!__AR.P.src||__AR.P.state==='playing'),3500))")
                    # every narration file referenced by the content exists
                    files = await pg.evaluate("""(async()=>{const keys=new Set();for(const k in __AR.N)for(const sg of __AR.N[k])for(const se of sg.sent)if(se.a)keys.add(se.a);
                      let ok=0,bad=[];for(const k of keys){const f=(parseInt(k[0],16)<8?'audio1/':'audio2/')+k+'.mp3';const r=await fetch(f,{method:'HEAD'});if(r.ok)ok++;else bad.push(f)}return {total:keys.size,ok,bad}})()""")
                    report['files']['audio'] = files
                await pg.close()
            await b.close()
    finally:
        srv.terminate()
    # content consistency against the storyboard (decision items, not automatic failures)
    txt = ''.join(open(os.path.join(ROOT, f), encoding='utf8').read() for f in ['data.js', 'app.js', 'models.js'])
    facts = [
        ('ออกกำลังกาย: ระยะเวลาและความถี่', 'Storyboard: 20–30 นาที แล้วเพิ่มเป็น 30–40 นาที, 3–5 วัน/สัปดาห์', ['20–30', '30–40', '3–5 วัน']),
        ('ผลไม้: ปริมาณต่อวัน', 'Storyboard: ไม่เกิน 1 กำมือต่อวัน', ['กำมือ']),
        ('มื้ออาหาร', 'Storyboard: กินให้ตรงเวลา ครบ 3 มื้อ/วัน', ['3 มื้อ']),
        ('การฝึกหายใจ SKT 1', 'Storyboard: เข้านับ 1–3 ออกนับ 1–5', ['SKT']),
        ('ระยะไต G1–G5', 'Storyboard: แบ่งตามค่า eGFR', ['G3a', 'G3b', 'G5']),
        ('หลัก 6:6:1', 'Storyboard: น้ำตาล 6 ไขมัน 6 เกลือ 1 ช้อนชา/วัน', ['6:6:1', '6 : 6 : 1']),
    ]
    for name, sb, keys in facts:
        found = [k for k in keys if k in txt]
        status = 'PASS' if len(found) == len(keys) or (name.startswith('หลัก') and found) else ('DECIDE' if not found or len(found) < len(keys) else 'PASS')
        report['content'].append({'item': name, 'storyboard': sb, 'status': status, 'found': found})
    json.dump(report, open(f'{OUT}/qc.json', 'w'), ensure_ascii=False, indent=1)
    nf = sum(1 for d in report['display'] for i in d['issues'] if i['sev'] == 'FAIL'); nw = sum(1 for d in report['display'] for i in d['issues'] if i['sev'] == 'WARN')
    print(f"display FAIL={nf} WARN={nw} | functions {sum(f['ok'] for f in report['functions'])}/{len(report['functions'])} | audio {report['files'].get('audio',{}).get('ok')}/{report['files'].get('audio',{}).get('total')} | errors {len(report['errors'])}")
    for d in report['display']:
        for i in d['issues']: print(f"  [{i['sev']}] {d['viewport']:8} {d['scene']} {d['name']}: {i['what']} — {i['item']}")
    for f in report['functions']:
        if not f['ok']: print('  [FAIL] function:', f['name'])
    for e in report['errors'][:10]: print('  [ERR]', e)
    for c in report['content']: print(f"  [{c['status']}] content: {c['item']} — found {c['found']}")
asyncio.run(run())
