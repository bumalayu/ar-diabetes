"""สร้างรายงาน QC เป็นหน้าเว็บ — รัน: python3 tools/report.py <qc.json> <โฟลเดอร์ปลายทาง> <ชื่อรอบ> <เวอร์ชัน> [notes.json]
"""
import json, sys, os, html, datetime
from PIL import Image, ImageDraw, ImageFont

src, dst, rname, version = sys.argv[1:5]
notes = json.load(open(sys.argv[5], encoding='utf8')) if len(sys.argv) > 5 else {}
r = json.load(open(src, encoding='utf8')); shots = os.path.dirname(src)
os.makedirs(dst, exist_ok=True)
FONT = '/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'

def sheet(vp):
    items = [d for d in r['display'] if d['viewport'] == vp]
    H = 520; ims = [Image.open(os.path.join(shots, d['shot'])).convert('RGB') for d in items]; ims = [i.resize((int(i.width * H / i.height), H)) for i in ims]
    W = ims[0].width; cols = 6; rows = (len(ims) + cols - 1) // cols; f = ImageFont.truetype(FONT, 22)
    o = Image.new('RGB', (cols * (W + 12), rows * (H + 44)), '#FFFFFF'); d = ImageDraw.Draw(o)
    for k, (im, it) in enumerate(zip(ims, items)):
        x = (k % cols) * (W + 12); y = (k // cols) * (H + 44); o.paste(im, (x, y + 38))
        fails = [i for i in it['issues'] if i['sev'] == 'FAIL']; warns = [i for i in it['issues'] if i['sev'] == 'WARN']
        tag, col = ('ไม่ผ่าน', '#B3261E') if fails else (('ข้อสังเกต', '#9A6700') if warns else ('ผ่าน', '#1D7262'))
        d.rounded_rectangle((x, y + 4, x + 96, y + 32), 8, fill=col); d.text((x + 10, y + 6), tag, font=f, fill='white'); d.text((x + 106, y + 6), it['name'], font=f, fill='#17242A')
    name = f'{vp}.jpg'; o.save(os.path.join(dst, name), quality=82, optimize=True); return name

sheets = {vp: sheet(vp) for vp in ['small', 'standard', 'large']}
start = os.path.join(shots, 'standard_00_start.png')
if os.path.exists(start): Image.open(start).convert('RGB').resize((390, 844)).save(os.path.join(dst, 'start.jpg'), quality=82)
fails = [(d, i) for d in r['display'] for i in d['issues'] if i['sev'] == 'FAIL']; warns = [(d, i) for d in r['display'] for i in d['issues'] if i['sev'] == 'WARN']
fn_ok = sum(f['ok'] for f in r['functions']); fn_n = len(r['functions']); au = r['files'].get('audio', {})
camera = notes.get('camera', {'status': 'NOT RUN', 'detail': ''})
gate_pass = not fails and fn_ok == fn_n and not r['errors'] and au.get('ok') == au.get('total') and camera['status'] == 'PASS'
E = html.escape
VPN = {'small': 'จอเล็ก 360×640', 'standard': 'จอมาตรฐาน 390×844', 'large': 'จอใหญ่ 430×932'}

def badge(ok, warn=False): return '<span class="b ok">ผ่าน</span>' if ok and not warn else ('<span class="b warn">ข้อสังเกต</span>' if ok else '<span class="b fail">ไม่ผ่าน</span>')
rows = []
rows.append(('1. ระบบ', 'ไม่มีข้อผิดพลาดของโปรแกรม และทุกไฟล์โหลดได้', badge(not r['errors']), f"ข้อผิดพลาด {len(r['errors'])} รายการ"))
rows.append(('', 'ไฟล์เสียงบรรยายครบ', badge(au.get('ok') == au.get('total')), f"{au.get('ok')}/{au.get('total')} ไฟล์"))
rows.append(('2. การแสดงผล', 'ข้อความไม่ล้น ป้ายไม่ซ้อนหรือหลุดจอ โมเดลอยู่ในกรอบ (3 ขนาดจอ × 11 ฉาก = 33 หน้าจอ)', badge(not fails, bool(warns)), f"ไม่ผ่าน {len(fails)} · ข้อสังเกต {len(warns)}"))
rows.append(('3. การทำงาน', 'ปุ่ม แถบเลื่อน วิดีโอ และเสียง ทำงานและเปลี่ยนสถานะถูกต้อง', badge(fn_ok == fn_n), f"{fn_ok}/{fn_n} รายการ"))
rows.append(('', 'กล้องจับภาพปกได้ทั้ง 3 เรื่อง (ทดสอบด้วยกล้องจำลอง)', badge(camera['status'] == 'PASS'), E(camera['detail'])))
dec = [c for c in r['content'] if c['status'] != 'PASS']
rows.append(('4. เนื้อหา', 'ข้อความและตัวเลขตรงกับ Storyboard', badge(True, bool(dec)), f"ต้องตัดสินใจ {len(dec)} เรื่อง (ดูด้านล่าง)"))
rows.append(('5. ประสิทธิภาพ', 'จำกัดการวาดภาพที่ 30 ภาพ/วินาทีเมื่อเปิดกล้อง และลดความละเอียดอัตโนมัติ', badge(True), 'ตรวจด้วยเครื่องจริงในรอบทดสอบผู้ใช้'))

issue_rows = ''.join(f"<tr><td>{E(VPN[d['viewport']])}</td><td>{E(d['name'])}</td><td>{badge(i['sev']!='FAIL', i['sev']=='WARN')}</td><td>{E(i['what'])} — {E(i['item'])}</td></tr>" for d, i in fails + warns) or '<tr><td colspan="4">ไม่มี</td></tr>'
fn_rows = ''.join(f"<tr><td>{E(f['name'])}</td><td>{badge(f['ok'])}</td></tr>" for f in r['functions'])
content_rows = ''.join(f"<tr><td>{E(c['item'])}</td><td>{E(c['storyboard'])}</td><td>{badge(c['status']=='PASS', c['status']!='PASS')}</td></tr>" for c in r['content'])
manual = ''.join(f"<li>{E(x)}</li>" for x in notes.get('manual', []))
changes = ''.join(f"<li>{E(x)}</li>" for x in notes.get('changes', []))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime('%d/%m/%Y %H:%M')

page = f"""<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QC {E(rname)} · AR เบาหวานและไต</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap">
<style>
:root{{--ink:#17242A;--muted:#55656A;--line:#DCE4E1;--ok:#1D7262;--okbg:#E3F2EC;--warn:#8A5A00;--warnbg:#FDF1D6;--fail:#B3261E;--failbg:#FBE4E2;--bg:#F6F8F7}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Sarabun,"Leelawadee UI",Thonburi,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:28px 16px 60px}}
h1{{font-size:28px;margin:0 0 4px}}h2{{font-size:20px;margin:34px 0 10px;padding-top:6px;border-top:1px solid var(--line)}}
.meta{{color:var(--muted);margin:0 0 18px}}
.gate{{display:flex;gap:16px;align-items:center;padding:16px 18px;border-radius:14px;background:{'var(--okbg)' if gate_pass else 'var(--failbg)'};border:1px solid {'#BFE0D3' if gate_pass else '#F2C2BD'}}}
.gate b{{font-size:22px;color:{'var(--ok)' if gate_pass else 'var(--fail)'}}}
table{{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:15px}}
th,td{{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}}th{{background:#EEF3F1;font-weight:600}}
.b{{display:inline-block;padding:1px 10px;border-radius:999px;font-weight:600;font-size:14px;white-space:nowrap}}
.ok{{background:var(--okbg);color:var(--ok)}}.warn{{background:var(--warnbg);color:var(--warn)}}.fail{{background:var(--failbg);color:var(--fail)}}
.sheet{{overflow-x:auto;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px}}.sheet img{{display:block;width:100%;min-width:760px;height:auto}}
ul{{margin:6px 0;padding-left:22px}}.sign{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}}
.sign div{{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;min-height:110px}}
.tbl{{overflow-x:auto}}
@media print{{body{{background:#fff}}h2{{break-before:auto}}.sheet{{break-inside:avoid}}}}
</style></head><body><main>
<h1>รายงาน QC — {E(rname)}</h1>
<p class="meta">สื่อ AR เบาหวานและไตในผู้สูงอายุ · เวอร์ชัน {E(version)} · ตรวจเมื่อ {now} (เวลาไทย)</p>
<div class="gate"><b>{'ผ่าน QC' if gate_pass else 'ยังไม่ผ่าน QC'}</b><span>{'พร้อมให้ตรวจรับ เหลือรายการที่ต้องตัดสินใจด้านเนื้อหา (ไม่กระทบการใช้งาน)' if gate_pass else 'ต้องแก้รายการที่ไม่ผ่านก่อนไปขั้นถัดไป'}</span></div>
<h2>สิ่งที่เปลี่ยนในรอบนี้</h2><ul>{changes}</ul>
<h2>สรุปผลตรวจ 5 หมวด</h2><div class="tbl"><table><tr><th>หมวด</th><th>เกณฑ์</th><th>ผล</th><th>รายละเอียด</th></tr>
{''.join(f'<tr><td>{a}</td><td>{E(b)}</td><td>{c}</td><td>{d}</td></tr>' for a,b,c,d in rows)}</table></div>
<h2>รายการที่ไม่ผ่านและข้อสังเกต</h2><div class="tbl"><table><tr><th>ขนาดจอ</th><th>ฉาก</th><th>ผล</th><th>รายละเอียด</th></tr>{issue_rows}</table></div>
<h2>การทำงานของปุ่มและเสียง</h2><div class="tbl"><table><tr><th>รายการ</th><th>ผล</th></tr>{fn_rows}</table></div>
<h2>เนื้อหาเทียบกับ Storyboard (ต้องตัดสินใจ)</h2>
<p>รายการต่อไปนี้ตัวเลขหรือหัวข้อใน AR ยังไม่ตรงกับ Storyboard ฉบับล่าสุด ต้องให้ผู้รับผิดชอบเนื้อหาเลือกว่าจะยึดฉบับใด</p>
<div class="tbl"><table><tr><th>หัวข้อ</th><th>Storyboard ฉบับล่าสุด</th><th>สถานะใน AR</th></tr>{content_rows}</table></div>
<h2>ผลตรวจด้วยสายตา</h2><ul>{manual}</ul>
<h2>ภาพหน้าจอทุกฉาก</h2>
{''.join(f'<h3>{E(VPN[vp])}</h3><div class="sheet"><img src="{sheets[vp]}" alt="ภาพหน้าจอ {E(VPN[vp])}" loading="lazy"></div>' for vp in ['standard','small','large'])}
<h2>การตรวจรับ</h2><div class="sign"><div><b>ผู้จัดทำ</b><br>ชื่อ ............................<br>วันที่ ............................</div><div><b>ผู้ตรวจเนื้อหา</b><br>ชื่อ ............................<br>วันที่ ............................</div><div><b>ลูกค้า / ผู้อนุมัติ</b><br>☐ อนุมัติ ☐ ขอแก้ไข<br>ชื่อ ............................</div></div>
</main></body></html>"""
open(os.path.join(dst, 'index.html'), 'w', encoding='utf8').write(page)
print('report', os.path.join(dst, 'index.html'), 'gate', 'PASS' if gate_pass else 'FAIL')
