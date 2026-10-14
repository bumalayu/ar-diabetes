// คลังโมเดล 3 มิติ — สร้างด้วยโค้ดทั้งหมด (ไม่ต้องโหลดไฟล์โมเดล) ใช้วัสดุแบบ PBR และพื้นผิวที่สร้างขึ้นเอง
// หน่วย: โมเดลสูงประมาณ 2 หน่วย ยืนบนแท่นกลมรัศมี 1.35 ที่ y = 0
export function createModels(E) {
  const { T, label, callout, lin, lerp, ease, S, VID, CARE, ROUTINE, STEPS, STAGES, STAGE_C, STEPW, stageIdx, RBox } = E;
  const TAU = Math.PI * 2;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const FONT = 'Mitr, Sarabun, "Leelawadee UI", Thonburi, sans-serif';
  const BODY = 'Sarabun, Mitr, "Leelawadee UI", Thonburi, sans-serif';

  /* ===================== palette + materials ===================== */
  const C = {
    teal: 0x1D7262, tealL: 0x5BC3A7, mint: 0xBFEBDD, gold: 0xF2B544, coral: 0xE0614E, red: 0xC8313C,
    cream: 0xF6F1E7, ink: 0x17242A, skin: 0xE7B48E, skinD: 0xC98F6A, grey: 0xDADADA, blue: 0x3E6FC7
  };
  const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .55, metalness: 0 }, o));
  // physical (clearcoat) shading is costly per pixel: only hero surfaces get it; everything else is standard PBR
  const gloss = (c, o = {}) => new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: .4, clearcoat: .5, clearcoatRoughness: .35 }, o));
  const phys = (c, o = {}) => { const q = Object.assign({ color: c, roughness: .4 }, o); const cc = q.clearcoat || 0; ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'transmission'].forEach(k => delete q[k]); q.roughness = Math.max(.12, q.roughness - cc * .15); return new T.MeshStandardMaterial(q) };
  const fabric = (c, o = {}) => { const q = Object.assign({ color: c, roughness: .86 }, o); ['sheen', 'sheenRoughness', 'sheenColor'].forEach(k => delete q[k]); return new T.MeshStandardMaterial(q) };
  const glass = (c = 0xffffff, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .05, metalness: .1, transparent: true, opacity: .22, depthWrite: false }, o));
  function M(g, m) { const x = new T.Mesh(g, m); return x }
  const rbox = (w, h, d, r, m, seg = 4) => M(new RBox(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)), m);
  function tube(pts, r, m, closed = false, seg = 64) { return M(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(a => V(...a)), closed), seg, r, 14, closed), m) }
  function taperTube(pts, r0, r1, m, seg = 48) {
    const curve = new T.CatmullRomCurve3(pts.map(a => V(...a))); const g = new T.TubeGeometry(curve, seg, 1, 14, false);
    const p = g.attributes.position, n = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i <= seg; i++) { const t = i / seg; const r = r0 + (r1 - r0) * t; curve.getPointAt(t, c); for (let j = 0; j <= 14; j++) { const k = i * 15 + j; n.fromBufferAttribute(p, k).sub(c); p.setXYZ(k, c.x + n.x * r, c.y + n.y * r, c.z + n.z * r) } }
    g.computeVertexNormals(); return M(g, m);
  }

  /* ===================== procedural textures ===================== */
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  function ctex(c, srgb = true) { const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t }
  const perm = (() => { const p = new Uint8Array(512); for (let i = 0; i < 256; i++) p[i] = i; let s = 1234567; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const tmp = p[i]; p[i] = p[j]; p[j] = tmp } for (let i = 0; i < 256; i++) p[i + 256] = p[i]; return p })();
  function vnoise(x, y) { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = x * x * (3 - 2 * x), v = y * y * (3 - 2 * y); const a = perm[perm[X] + Y] / 255, b = perm[perm[X + 1] + Y] / 255, c = perm[perm[X] + Y + 1] / 255, d = perm[perm[X + 1] + Y + 1] / 255; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v }
  function fbm(x, y, o = 5) { let a = 0, amp = .5, f = 1; for (let i = 0; i < o; i++) { a += amp * vnoise(x * f, y * f); f *= 2.03; amp *= .5 } return a }
  // tileable in x so sphere UV seams disappear
  function tfbm(u, v, sc, o) { const a = fbm(u * sc, v * sc, o), b = fbm((u - 1) * sc, v * sc, o); return a * (1 - u) + b * u }
  const mix = (a, b, t) => a + (b - a) * t;
  function surface({ base, dark, light, scale = 6, size = 256, bump = 1, spots = 0, seed = 0 }) {
    const W = size, H = size, cm = canvas(W, H), cn = canvas(W, H); const gm = cm.getContext('2d'), gn = cn.getContext('2d');
    const im = gm.createImageData(W, H), hh = new Float32Array(W * H);
    const B = new T.Color(base), D = new T.Color(dark), L = new T.Color(light);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H; let n = tfbm(u, v + seed, scale, 5);
      if (spots) { const s = tfbm(u, v + 3.1 + seed, scale * 2.6, 3); if (s > .62) n -= (s - .62) * spots }
      hh[y * W + x] = n;
      const t = Math.max(0, Math.min(1, (n - .3) * 1.6));
      const col = t < .5 ? D.clone().lerp(B, t * 2) : B.clone().lerp(L, (t - .5) * 2);
      const i = (y * W + x) * 4; im.data[i] = col.r * 255; im.data[i + 1] = col.g * 255; im.data[i + 2] = col.b * 255; im.data[i + 3] = 255;
    }
    gm.putImageData(im, 0, 0);
    const nm = gn.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const l = hh[y * W + ((x - 1 + W) % W)], r = hh[y * W + ((x + 1) % W)], u = hh[Math.max(0, y - 1) * W + x], d = hh[Math.min(H - 1, y + 1) * W + x];
      let nx = (l - r) * bump * 6, ny = (d - u) * bump * 6, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * W + x) * 4; nm.data[i] = (nx * .5 + .5) * 255; nm.data[i + 1] = (ny * .5 + .5) * 255; nm.data[i + 2] = (nz * .5 + .5) * 255; nm.data[i + 3] = 255;
    }
    gn.putImageData(nm, 0, 0);
    const map = ctex(cm), normalMap = ctex(cn, false); [map, normalMap].forEach(t => { t.wrapS = t.wrapT = T.RepeatWrapping });
    return { map, normalMap };
  }
  const TEX = {};
  function tex(name, f) { return TEX[name] || (TEX[name] = f()) }

  /* ===================== pictogram icons (drawn, not emoji) ===================== */
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
  const ICON = {
    sugar(g) { g.fillRect(-.36, -.08, .3, .3); g.fillRect(.02, -.08, .3, .3); g.fillRect(-.17, -.42, .3, .3) },
    drop(g) { g.beginPath(); g.moveTo(0, -.46); g.bezierCurveTo(.12, -.24, .36, -.04, .36, .16); g.arc(0, .16, .36, 0, Math.PI); g.bezierCurveTo(-.36, -.04, -.12, -.24, 0, -.46); g.fill() },
    meter(g) { rr(g, -.3, -.42, .6, .84, .12); g.fill(); g.globalCompositeOperation = 'destination-out'; rr(g, -.2, -.3, .4, .3, .05); g.fill(); g.beginPath(); g.arc(0, .2, .1, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over' },
    heart(g) { g.beginPath(); g.moveTo(0, .38); g.bezierCurveTo(-.5, .02, -.42, -.42, 0, -.18); g.bezierCurveTo(.42, -.42, .5, .02, 0, .38); g.fill() },
    bp(g) { ICON.heart(g); g.globalCompositeOperation = 'destination-out'; g.lineWidth = .07; g.beginPath(); g.moveTo(-.3, 0); g.lineTo(-.12, 0); g.lineTo(-.05, -.14); g.lineTo(.05, .14); g.lineTo(.12, 0); g.lineTo(.3, 0); g.stroke(); g.globalCompositeOperation = 'source-over' },
    salt(g) { rr(g, -.22, -.18, .44, .6, .08); g.fill(); g.beginPath(); g.ellipse(0, -.22, .22, .16, 0, Math.PI, 0); g.fill(); g.globalCompositeOperation = 'destination-out';[[-.08, -.28], [0, -.32], [.08, -.28]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, .03, 0, TAU); g.fill() }); g.globalCompositeOperation = 'source-over' },
    bowl(g) { g.beginPath(); g.arc(0, -.02, .42, 0, Math.PI); g.closePath(); g.fill(); g.fillRect(-.16, .38, .32, .06); g.beginPath(); g.arc(-.12, -.1, .12, Math.PI, 0); g.arc(.12, -.1, .14, Math.PI, 0); g.fill() },
    walk(g) {
      g.beginPath(); g.arc(.04, -.36, .1, 0, TAU); g.fill(); g.lineWidth = .11; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(.0, -.2); g.lineTo(-.06, .08); g.lineTo(-.22, .42); g.moveTo(-.06, .08); g.lineTo(.1, .22); g.lineTo(.12, .42); g.moveTo(-.02, -.12); g.lineTo(-.22, .02); g.moveTo(-.02, -.12); g.lineTo(.2, -.02); g.stroke()
    },
    glass(g) { g.beginPath(); g.moveTo(-.28, -.4); g.lineTo(.28, -.4); g.lineTo(.2, .42); g.lineTo(-.2, .42); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(-.2, -.32); g.lineTo(.2, -.32); g.lineTo(.18, -.05); g.lineTo(-.18, -.05); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over' },
    toilet(g) { ICON.drop(g); g.globalCompositeOperation = 'destination-out'; g.lineWidth = .08; g.beginPath(); g.moveTo(-.12, .14); g.lineTo(-.02, .26); g.lineTo(.16, .02); g.stroke(); g.globalCompositeOperation = 'source-over' },
    nosmoke(g) { rr(g, -.4, -.06, .66, .14, .03); g.fill(); g.fillRect(.3, -.06, .08, .14); g.lineWidth = .08; g.beginPath(); g.arc(0, 0, .44, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-.31, -.31); g.lineTo(.31, .31); g.stroke() },
    nopill(g) { g.save(); g.rotate(-.6); rr(g, -.36, -.14, .72, .28, .14); g.fill(); g.restore(); g.lineWidth = .08; g.beginPath(); g.arc(0, 0, .44, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-.31, -.31); g.lineTo(.31, .31); g.stroke() },
    lab(g) { rr(g, -.12, -.44, .24, .78, .12); g.fill(); g.fillRect(-.18, -.46, .36, .08); g.globalCompositeOperation = 'destination-out'; g.fillRect(-.06, -.34, .12, .3); g.globalCompositeOperation = 'source-over' },
    family(g) { [[-.24, .9], [.24, .9], [0, .7]].forEach(([x, s], i) => { g.beginPath(); g.arc(x, -.2 + (i === 2 ? .12 : 0), .11 * s, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x, .2 + (i === 2 ? .1 : 0), .17 * s, .22 * s, 0, Math.PI, 0); g.fill(); g.fillRect(x - .17 * s, .2 + (i === 2 ? .1 : 0), .34 * s, .2) }) },
    target(g) { g.lineWidth = .08;[.4, .26].forEach(r => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke() }); g.beginPath(); g.arc(0, 0, .1, 0, TAU); g.fill() },
    chart(g) { g.fillRect(-.36, .1, .16, .3); g.fillRect(-.1, -.12, .16, .52); g.fillRect(.16, -.36, .16, .76) },
    bulb(g) { g.beginPath(); g.arc(0, -.12, .28, Math.PI * .85, Math.PI * .15); g.lineTo(.1, .22); g.lineTo(-.1, .22); g.closePath(); g.fill(); g.fillRect(-.12, .26, .24, .07); g.fillRect(-.09, .36, .18, .06) },
    calendar(g) { rr(g, -.38, -.32, .76, .7, .08); g.fill(); g.globalCompositeOperation = 'destination-out'; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) g.fillRect(-.27 + c * .2, -.06 + r * .18, .14, .12); g.globalCompositeOperation = 'source-over'; g.fillRect(-.24, -.44, .08, .16); g.fillRect(.16, -.44, .08, .16) },
    check(g) { g.lineWidth = .14; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-.3, .02); g.lineTo(-.08, .24); g.lineTo(.32, -.22); g.stroke() },
    refresh(g) { g.lineWidth = .09; g.beginPath(); g.arc(0, 0, .3, -.3, Math.PI * 1.25); g.stroke(); g.beginPath(); g.moveTo(.36, -.32); g.lineTo(.36, .0); g.lineTo(.08, -.1); g.closePath(); g.fill() },
    eye(g) { g.beginPath(); g.moveTo(-.42, 0); g.quadraticCurveTo(0, -.36, .42, 0); g.quadraticCurveTo(0, .36, -.42, 0); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, 0, .14, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; g.beginPath(); g.arc(0, 0, .07, 0, TAU); g.fill() },
    kidney(g) { g.beginPath(); g.moveTo(.05, -.4); g.bezierCurveTo(.42, -.42, .44, .4, .05, .4); g.bezierCurveTo(-.2, .4, -.26, .2, -.1, .1); g.bezierCurveTo(.02, .02, .02, -.04, -.1, -.1); g.bezierCurveTo(-.26, -.2, -.22, -.4, .05, -.4); g.fill() },
    vessel(g) { g.lineWidth = .12; g.lineCap = 'round'; g.beginPath(); g.moveTo(-.36, .3); g.bezierCurveTo(-.1, .3, -.1, -.3, .36, -.3); g.stroke(); g.lineWidth = .07; g.beginPath(); g.moveTo(-.05, .0); g.lineTo(.25, .2); g.stroke() },
    nerve(g) { g.lineWidth = .07; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -.42); g.lineTo(0, .42); g.moveTo(0, -.1); g.lineTo(-.3, -.32); g.moveTo(0, .1); g.lineTo(.3, -.12); g.moveTo(0, .26); g.lineTo(-.28, .14); g.stroke(); g.beginPath(); g.arc(0, -.42, .08, 0, TAU); g.fill() },
    lotus(g) { for (let i = -2; i <= 2; i++) { g.save(); g.rotate(i * .38); g.beginPath(); g.ellipse(0, -.1, .1, .3, 0, 0, TAU); g.fill(); g.restore() } g.fillRect(-.36, .2, .72, .07) },
    pill(g) { g.save(); g.rotate(-.6); rr(g, -.38, -.15, .76, .3, .15); g.fill(); g.restore() },
    stress(g) { ICON.lotus(g) }
  };
  function iconCanvas(name, { size = 256, bg = '#1D7262', fg = '#FFFFFF', ring = null, num = null } = {}) {
    const c = canvas(size, size), g = c.getContext('2d'); const s = size / 2;
    g.translate(s, s);
    g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = size * .05; g.shadowOffsetY = size * .02;
    g.fillStyle = bg; g.beginPath(); g.arc(0, 0, s * .9, 0, TAU); g.fill(); g.shadowColor = 'transparent';
    if (ring) { g.strokeStyle = ring; g.lineWidth = s * .1; g.beginPath(); g.arc(0, 0, s * .84, 0, TAU); g.stroke() }
    g.save(); g.scale(s * .9, s * .9); g.fillStyle = fg; g.strokeStyle = fg; (ICON[name] || ICON.check)(g); g.restore();
    if (num != null) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(s * .58, -s * .58, s * .3, 0, TAU); g.fill(); g.fillStyle = bg; g.font = `600 ${s * .38}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), s * .58, -s * .55) }
    return c;
  }
  function iconSprite(name, h, opt) { const sp = new T.Sprite(new T.SpriteMaterial({ map: ctex(iconCanvas(name, opt)), transparent: true, toneMapped: false })); sp.scale.set(h, h, 1); sp.userData.base = sp.scale.clone(); sp.renderOrder = 12; return sp }

  /* ===================== shared parts ===================== */
  function plinth() {
    const g = new T.Group();
    const prof = [[0, 0], [1.3, 0], [1.36, .02], [1.38, .06], [1.36, .1], [1.3, .115], [0, .115]].map(([x, y]) => new T.Vector2(x, y));
    g.add(M(new T.LatheGeometry(prof, 72), gloss(0xF4F1EA, { roughness: .32, clearcoat: .7 })));
    const inlay = M(new T.RingGeometry(1.12, 1.18, 96), std(C.teal, { roughness: .4 })); inlay.rotation.x = -Math.PI / 2; inlay.position.y = .117; g.add(inlay);
    return g;
  }
  // text panel: a flat card with crisp canvas text, for things that should not face the camera
  function textCard(w, h, draw, { px = 512, depth = .03, r = .06, mat = 0xFFFFFF } = {}) {
    const g = new T.Group(); const c = canvas(px, Math.round(px * h / w)); const t = ctex(c);
    const card = rbox(w, h, depth, r, phys(mat, { roughness: .5, clearcoat: .3 })); g.add(card);
    const face = M(new T.PlaneGeometry(w * .96, h * .96), new T.MeshStandardMaterial({ map: t, roughness: .6, transparent: true })); face.position.z = depth / 2 + .002; g.add(face);
    g.userData.redraw = (...a) => { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); draw(ctx, c.width, c.height, ...a); t.needsUpdate = true };
    g.userData.redraw(); return g;
  }

  /* ===================== people ===================== */
  function person(o = {}) {
    const P = Object.assign({ shirt: 0x7FB2E0, pants: 0x34445F, skin: C.skin, hair: 'bun', hairColor: 0xE4E4E4, glasses: true, scale: 1, shoes: 0x4A3B33, stoop: .04, collar: 0xFFFFFF, skirt: false }, o);
    const g = new T.Group(); g.scale.setScalar(P.scale);
    const skin = std(P.skin, { roughness: .58 });
    const shirt = fabric(P.shirt), pants = fabric(P.pants), shoe = phys(P.shoes, { roughness: .45, clearcoat: .4 }), hairM = fabric(P.hairColor, { roughness: .9, sheen: .6 });
    const hips = new T.Group(); hips.position.y = .97; g.add(hips);
    const pel = M(new T.SphereGeometry(.205, 20, 14), pants); pel.scale.set(1.05, .62, .8); hips.add(pel);
    const spine = new T.Group(); spine.position.y = .04; spine.rotation.x = P.stoop; hips.add(spine);
    const tp = [[0, -.02], [.19, -.02], [.205, .12], [.198, .3], [.215, .44], [.19, .53], [.12, .585], [.06, .6], [0, .6]].map(([x, y]) => new T.Vector2(x, y));
    const torso = M(new T.LatheGeometry(tp, 28), shirt); torso.scale.set(1, 1, .76); spine.add(torso);
    if (P.skirt) { const sk = M(new T.CylinderGeometry(.21, .3, .42, 32, 1, true), fabric(P.pants, { side: T.DoubleSide })); sk.position.y = -.2; spine.add(sk) }
    const collar = M(new T.TorusGeometry(.075, .022, 10, 28), fabric(P.collar)); collar.rotation.x = Math.PI / 2; collar.position.y = .59; spine.add(collar);
    for (let i = 0; i < 3; i++) { const b = M(new T.SphereGeometry(.012, 8, 6), std(0xFFFFFF, { roughness: .3 })); b.position.set(0, .48 - i * .12, .158); spine.add(b) }
    const neck = M(new T.CapsuleGeometry(.05, .06, 4, 12), skin); neck.position.y = .64; spine.add(neck);
    // head
    const head = new T.Group(); head.position.y = .79; spine.add(head);
    const skull = M(new T.SphereGeometry(.135, 28, 20), skin); skull.scale.set(.96, 1.08, 1); head.add(skull);
    [-1, 1].forEach(s => { const ear = M(new T.SphereGeometry(.03, 12, 10), skin); ear.scale.set(.6, 1, .8); ear.position.set(s * .13, 0, -.005); head.add(ear) });
    const nose = M(new T.SphereGeometry(.024, 14, 10), skin); nose.scale.set(.9, 1, 1.1); nose.position.set(0, -.012, .133); head.add(nose);
    const eyes = []; const lids = [];
    [-1, 1].forEach(s => {
      const e = M(new T.SphereGeometry(.016, 14, 10), std(0x2A2422, { roughness: .2 })); e.position.set(s * .046, .018, .118); head.add(e); eyes.push(e);
      const hl = M(new T.SphereGeometry(.005, 8, 6), new T.MeshBasicMaterial({ color: 0xFFFFFF })); hl.position.set(s * .046 + .005, .025, .133); head.add(hl); e.userData.hl = hl;
      const lid = M(new T.TorusGeometry(.016, .004, 6, 14, Math.PI), std(0x6B4A3A)); lid.position.set(s * .046, .016, .124); lid.rotation.z = Math.PI; lid.visible = false; head.add(lid); lids.push(lid);
      const brow = rbox(.05, .011, .012, .005, std(P.hairColor === 0xE4E4E4 ? 0xBDBDBD : 0x2B2220)); brow.position.set(s * .048, .062, .122); brow.rotation.z = -s * .12; head.add(brow);
      const cheek = M(new T.CircleGeometry(.024, 16), new T.MeshBasicMaterial({ color: 0xF0A090, transparent: true, opacity: .45, depthWrite: false })); cheek.position.set(s * .075, -.03, .118); cheek.rotation.y = s * .45; head.add(cheek);
    });
    const mouthMat = std(0x9B3F35, { roughness: .4 });
    const mouth = M(new T.TorusGeometry(.03, .0065, 8, 18, Math.PI), mouthMat); mouth.position.set(0, -.058, .124); mouth.rotation.z = Math.PI; head.add(mouth);
    if (P.glasses) {
      const gm = std(0x5A4636, { roughness: .35, metalness: .2 });
      [-1, 1].forEach(s => { const r = M(new T.TorusGeometry(.03, .004, 8, 28), gm); r.position.set(s * .046, .018, .138); head.add(r); const arm = M(new T.CylinderGeometry(.003, .003, .13, 6), gm); arm.rotation.x = Math.PI / 2; arm.position.set(s * .1, .022, .075); head.add(arm) });
      const br = M(new T.CylinderGeometry(.003, .003, .03, 6), gm); br.rotation.z = Math.PI / 2; br.position.set(0, .024, .14); head.add(br);
      [-1, 1].forEach(s => { const l = M(new T.CircleGeometry(.028, 20), glass(0xDDEEFF, { opacity: .18 })); l.position.set(s * .046, .018, .139); head.add(l) });
    }
    // hair styles
    const cap = M(new T.SphereGeometry(.146, 24, 14, 0, TAU, 0, Math.PI * .56), hairM); cap.scale.set(.98, 1.08, 1.04); cap.rotation.x = -.32; cap.position.set(0, .016, -.012); head.add(cap);
    if (P.hair === 'bun') { const bun = M(new T.SphereGeometry(.075, 24, 16), hairM); bun.position.set(0, .09, -.12); head.add(bun); [-1, 1].forEach(s => { const side = M(new T.SphereGeometry(.07, 20, 14), hairM); side.scale.set(.6, 1, .9); side.position.set(s * .11, .0, -.03); head.add(side) }) }
    if (P.hair === 'short') { cap.scale.set(.99, 1.0, 1.02); cap.rotation.x = -.5 }
    if (P.hair === 'long') { const back = M(new T.CapsuleGeometry(.12, .14, 6, 20), hairM); back.scale.set(1.1, 1, .6); back.position.set(0, -.07, -.07); head.add(back); const tie = M(new T.TorusGeometry(.03, .01, 8, 16), fabric(C.coral)); tie.position.set(0, -.02, -.14); head.add(tie) }
    if (P.hair === 'kid') { cap.rotation.x = -.15; const fr = M(new T.SphereGeometry(.13, 20, 12, 0, TAU, 0, Math.PI * .3), hairM); fr.position.set(0, .06, .03); fr.rotation.x = .5; head.add(fr) }
    // limbs
    function limb(len, r, mat) { const j = new T.Group(); const m = M(new T.CapsuleGeometry(r, Math.max(.01, len - r * 1.2), 4, 12), mat); m.position.y = -len / 2; j.add(m); return j }
    function arm(s) {
      const sh = limb(.29, .058, shirt); sh.position.set(s * .23, .5, 0); spine.add(sh);
      const cuff = M(new T.TorusGeometry(.05, .014, 8, 20), shirt); cuff.rotation.x = Math.PI / 2; cuff.position.y = -.27; sh.add(cuff);
      const el = limb(.26, .044, skin); el.position.y = -.29; sh.add(el);
      const hand = new T.Group(); hand.position.y = -.27; el.add(hand);
      const palm = M(new T.SphereGeometry(.05, 16, 12), skin); palm.scale.set(.75, 1.15, .5); palm.position.y = -.03; hand.add(palm);
      const th = M(new T.CapsuleGeometry(.014, .03, 4, 8), skin); th.position.set(s * -.03, -.02, .02); th.rotation.z = s * .7; hand.add(th);
      return [sh, el, hand];
    }
    function leg(s) {
      const th = limb(.42, .085, pants); th.position.set(s * .1, -.06, 0); hips.add(th);
      const kn = limb(.42, .068, pants); kn.position.y = -.42; th.add(kn);
      const ft = new T.Group(); ft.position.y = -.42; kn.add(ft);
      const f = rbox(.12, .075, .26, .035, shoe); f.position.set(0, -.04, .055); ft.add(f);
      const sole = rbox(.125, .02, .265, .01, std(0xEDE6DA)); sole.position.set(0, -.077, .055); ft.add(sole);
      return [th, kn, ft];
    }
    const [lS, lE, lH] = arm(-1), [rS, rE, rH] = arm(1), [lT, lK, lF] = leg(-1), [rT, rK, rF] = leg(1);
    lS.rotation.z = -.1; rS.rotation.z = .1; lE.rotation.x = rE.rotation.x = -.08;
    let blinkT = 2 + Math.random() * 3;
    const api = {
      group: g, hips, spine, head, lS, lE, lH, rS, rE, rH, lT, lK, lF, rT, rK, rF, mouth, skull,
      mood(m) { // 'happy' | 'flat' | 'sad'
        if (m === 'happy') { mouth.rotation.z = Math.PI; mouth.scale.set(1, 1, 1); mouth.position.y = -.058 }
        else if (m === 'sad') { mouth.rotation.z = 0; mouth.scale.set(.8, .7, 1); mouth.position.y = -.075 }
        else { mouth.rotation.z = Math.PI; mouth.scale.set(.9, .25, 1); mouth.position.y = -.062 }
      },
      closeEyes(v) { eyes.forEach(e => { e.visible = !v; e.userData.hl.visible = !v }); lids.forEach(l => l.visible = v) },
      tick(t, dt) { blinkT -= dt; if (blinkT < 0 && eyes[0].visible) { eyes.forEach(e => e.scale.y = .1); if (blinkT < -.12) { eyes.forEach(e => e.scale.y = 1); blinkT = 2.5 + Math.random() * 3 } } }
    };
    return api;
  }
  function chairMesh() {
    const ch = new T.Group(); const wood = phys(0xA36F45, { roughness: .45, clearcoat: .5 }), cush = fabric(0x2E9B7E);
    const seat = rbox(.54, .06, .5, .02, wood); seat.position.y = .47; ch.add(seat);
    const pad = rbox(.5, .05, .46, .025, cush); pad.position.y = .52; ch.add(pad);
    [[-.24, -.21], [.24, -.21], [-.24, .21], [.24, .21]].forEach(([x, z]) => { const l = rbox(.045, .47, .045, .012, wood); l.position.set(x, .235, z); ch.add(l) });
    [-.24, .24].forEach(x => { const l = rbox(.045, .55, .045, .012, wood); l.position.set(x, .78, -.21); ch.add(l) });
    const back = rbox(.54, .22, .04, .02, wood); back.position.set(0, .94, -.22); ch.add(back);
    return ch;
  }

  /* ===================== kidney anatomy ===================== */
  // circle-space (x,y in [-1,1]) → kidney-space; same mapping for the shell and for drawing the cut face
  function kmap(x, y) { const X = x * .62; const k = Math.exp(-(y * y) / (2 * .16)); const side = Math.max(0, Math.min(1, -X / .62)); return [X + .42 * k * Math.pow(side, 1.6) + .06 * y * y, y] }
  function kidneyHalf(bumpy) {
    const g = new T.SphereGeometry(1, 96, 64, Math.PI, Math.PI); const p = g.attributes.position; const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); let [x, y] = kmap(v.x, v.y); let z = v.z * .46;
      if (bumpy) { const n = (fbm(v.x * 2.2 + 3, v.y * 2.2 + 1, 3) - .5); const s = 1 + .07 * n * (Math.abs(v.z) > .05 ? 1 : 0); x *= s; y *= s; z *= s }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  function kidneyFull(bumpy) { const a = kidneyHalf(bumpy); const b = a.clone(); b.scale(1, 1, -1); const ix = b.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t } b.computeVertexNormals(); return [a, b] }
  function outline(n = 160) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(kmap(Math.cos(a), Math.sin(a))) } return pts }
  const KB = (() => { const o = outline(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; o.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }); return { x0, x1, y0, y1 } })();
  function sectionCanvas(bad) {
    const W = 512, H = Math.round(W * (KB.y1 - KB.y0) / (KB.x1 - KB.x0)); const c = canvas(W, H), g = c.getContext('2d');
    const P = (x, y) => [(x - KB.x0) / (KB.x1 - KB.x0) * W, (1 - (y - KB.y0) / (KB.y1 - KB.y0)) * H];
    const path = (r, cx = 0) => { g.beginPath(); for (let i = 0; i <= 160; i++) { const a = i / 160 * TAU; const [x, y] = kmap(cx + Math.cos(a) * r, Math.sin(a) * r); const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py) } g.closePath() };
    // capsule + cortex
    path(1); g.fillStyle = bad ? '#B58A7C' : '#C2584A'; g.fill();
    path(bad ? .93 : .9); g.fillStyle = bad ? '#A57A6C' : '#B4473C'; g.fill();
    // granular cortex speckle
    for (let i = 0; i < 1400; i++) { const a = Math.random() * TAU, r = (bad ? .78 : .7) + Math.random() * (bad ? .14 : .2); const [x, y] = kmap(Math.cos(a) * r, Math.sin(a) * r); const [px, py] = P(x, y); g.fillStyle = Math.random() < .5 ? 'rgba(120,20,20,.25)' : 'rgba(255,200,180,.18)'; g.fillRect(px, py, 2, 2) }
    // medulla pyramids
    const n = 8, hil = P(...kmap(-1, 0));
    for (let i = 0; i < n; i++) {
      const ang = (-.72 + i / (n - 1) * 1.44) * Math.PI; const base0 = ang - .16, base1 = ang + .16, rb = bad ? .76 : .68;
      const b0 = P(...kmap(Math.cos(base0) * rb, Math.sin(base0) * rb)), b1 = P(...kmap(Math.cos(base1) * rb, Math.sin(base1) * rb));
      const ap = P(...kmap(Math.cos(ang) * .3 - .05, Math.sin(ang) * .3));
      const grd = g.createLinearGradient((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, ap[0], ap[1]); grd.addColorStop(0, bad ? '#8E5F55' : '#8E2A26'); grd.addColorStop(1, bad ? '#A87F72' : '#A8463A');
      g.fillStyle = grd; g.beginPath(); g.moveTo(...b0); g.quadraticCurveTo((b0[0] + b1[0]) / 2 + (b0[0] + b1[0] - 2 * ap[0]) * .08, (b0[1] + b1[1]) / 2 + (b0[1] + b1[1] - 2 * ap[1]) * .08, ...b1); g.lineTo(...ap); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,10,10,.35)'; g.lineWidth = 1.2; for (let k = 1; k < 6; k++) { const t = k / 6; g.beginPath(); g.moveTo(b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t); g.lineTo(ap[0], ap[1]); g.stroke() }
      // calyx cup
      g.fillStyle = '#F2D7A0'; g.beginPath(); g.arc(ap[0], ap[1], 7, 0, TAU); g.fill();
    }
    // renal pelvis funnel toward the hilum
    const pv = [P(...kmap(-.3, .38)), P(...kmap(-.3, -.38)), P(...kmap(-1, -.14)), P(...kmap(-1, .14))];
    g.fillStyle = '#F2D7A0'; g.beginPath(); g.moveTo(...pv[0]); g.quadraticCurveTo(pv[0][0] + 40, (pv[0][1] + pv[1][1]) / 2, ...pv[1]); g.lineTo(...pv[2]); g.lineTo(...pv[3]); g.closePath(); g.fill();
    g.strokeStyle = '#E3BE7E'; g.lineWidth = 6; for (let i = 0; i < 8; i++) { const a = (-.72 + i / 7 * 1.44) * Math.PI; const ap = P(...kmap(Math.cos(a) * .3 - .05, Math.sin(a) * .3)); g.beginPath(); g.moveTo(...ap); g.lineTo(pv[0][0] - 10, (pv[0][1] + pv[1][1]) / 2); g.stroke() }
    // vessels in the sinus
    g.strokeStyle = '#D0353A'; g.lineWidth = 5; g.beginPath(); g.moveTo(...hil); g.bezierCurveTo(hil[0] + 60, hil[1] - 50, hil[0] + 120, hil[1] - 120, hil[0] + 150, hil[1] - 170); g.stroke();
    g.strokeStyle = '#3E6FC7'; g.beginPath(); g.moveTo(hil[0], hil[1] + 10); g.bezierCurveTo(hil[0] + 60, hil[1] + 60, hil[0] + 120, hil[1] + 120, hil[0] + 150, hil[1] + 170); g.stroke();
    if (bad) { g.fillStyle = 'rgba(240,235,225,.55)'; for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, r = .82 + Math.random() * .1; const [px, py] = P(...kmap(Math.cos(a) * r, Math.sin(a) * r)); g.beginPath(); g.ellipse(px, py, 10 + Math.random() * 10, 5, a, 0, TAU); g.fill() } }
    return c;
  }
  function sectionMesh(bad) {
    const pts = outline(); const shape = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
    const geo = new T.ShapeGeometry(shape, 1); const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - KB.x0) / (KB.x1 - KB.x0), (p.getY(i) - KB.y0) / (KB.y1 - KB.y0));
    const t = ctex(sectionCanvas(bad)); return M(geo, new T.MeshPhysicalMaterial({ map: t, roughness: .45, clearcoat: .6, clearcoatRoughness: .25, side: T.DoubleSide }));
  }
  function kidneyModel({ cut = true } = {}) {
    const g = new T.Group();
    const sOk = tex('kOk', () => surface({ base: 0xB84A3E, dark: 0x7E2622, light: 0xD9705E, scale: 5, bump: 1.3 }));
    const sBad = tex('kBad', () => surface({ base: 0xA9837A, dark: 0x6E4A42, light: 0xC9A79C, scale: 7, bump: 2.4, spots: 1.4, seed: 2 }));
    const mat = new T.MeshPhysicalMaterial({ color: 0xFFFFFF, map: sOk.map, normalMap: sOk.normalMap, normalScale: new T.Vector2(.6, .6), roughness: .36, clearcoat: .8, clearcoatRoughness: .2 });
    const geoOk = kidneyFull(false), geoBad = kidneyFull(true);
    const back = M(geoOk[0], mat), front = M(geoOk[1], mat); g.add(back, front);
    const secOk = sectionMesh(false), secBad = sectionMesh(true); secOk.position.z = secBad.position.z = .001; g.add(secOk, secBad); secBad.visible = false;
    const art = gloss(0xD0353A, { roughness: .3, clearcoat: .8 }), vein = gloss(0x3E6FC7, { roughness: .3, clearcoat: .8 }), uret = gloss(0xE8C987, { roughness: .35, clearcoat: .6 });
    const hx = kmap(-1, 0)[0];
    g.add(taperTube([[hx + .05, .14, -.04], [hx - .25, .2, -.06], [hx - .6, .3, -.08], [hx - .95, .34, -.08]], .05, .075, art));
    g.add(taperTube([[hx + .05, .02, -.08], [hx - .3, .02, -.1], [hx - .65, .08, -.12], [hx - 1.0, .12, -.12]], .06, .085, vein));
    g.add(taperTube([[hx + .05, -.12, -.06], [hx - .12, -.32, -.06], [hx - .14, -.7, -.06], [hx - .1, -1.18, -.04]], .07, .045, uret));
    [[.16, .25], [.1, .32], [-.02, .3]].forEach(([dy, l]) => { g.add(taperTube([[hx + .05, .14, -.04], [hx + .05 + l * .5, .14 + dy, -.05], [hx + .05 + l, .14 + dy * 1.6, -.05]], .03, .012, art)) });
    const drops = []; for (let i = 0; i < 8; i++) { const d = M(new T.SphereGeometry(.05, 16, 12), phys(0xF2C230, { emissive: 0x6b5200, emissiveIntensity: .35, roughness: .2, transparent: true })); d.userData.o = i / 8; d.visible = false; g.add(d); drops.push(d) }
    let bad = 0, target = 0, dripFast = false; const cOk = new T.Color(1, 1, 1), cBad = new T.Color(1, 1, 1);
    const api = {
      group: g, hilumX: hx,
      setCut(v) { front.visible = !v; secOk.visible = v && target < .5; secBad.visible = v && target >= .5 },
      setBad(b) { target = b ? 1 : 0; const geo = b ? geoBad : geoOk; back.geometry = geo[0]; front.geometry = geo[1]; const s = b ? sBad : sOk; mat.map = s.map; mat.normalMap = s.normalMap; mat.needsUpdate = true; if (!front.visible) { secOk.visible = !b; secBad.visible = b } },
      setFast(f) { dripFast = f },
      update(t, dt) {
        bad = lerp(bad, target, Math.min(1, dt * 3)); mat.roughness = .36 + .35 * bad; mat.clearcoat = .8 * (1 - bad) + .15;
        const s = 1 - .14 * bad; [back, front, secOk, secBad].forEach(m => m.scale.set(s, s, s));
        drops.forEach(d => { d.visible = bad > .5; const sp = dripFast ? .9 : .5; const ph = ((t * sp) + d.userData.o) % 1; d.position.set(hx - .1 + Math.sin(ph * 9) * .01, -1.2 - ph * .55, -.04); d.material.opacity = 1 - ph; d.scale.setScalar(.6 + .6 * (1 - ph)) });
      }
    };
    api.setCut(cut); return api;
  }
  // glomerulus inside a magnifier: grey waste passes the filter, yellow protein stays (healthy) or leaks (damaged)
  function glomerulus() {
    const g = new T.Group();
    const lensRim = M(new T.TorusGeometry(.62, .045, 16, 96), phys(0xF4F1EA, { roughness: .25, clearcoat: 1 })); g.add(lensRim);
    const handle = rbox(.09, .5, .09, .04, phys(C.teal, { roughness: .35 })); handle.position.set(.48, -.62, 0); handle.rotation.z = .75; g.add(handle);
    const back = M(new T.CircleGeometry(.6, 64), std(0xFFF6EE, { roughness: .9 })); back.position.z = -.05; g.add(back);
    const lens = M(new T.SphereGeometry(.6, 48, 24, 0, TAU, 0, Math.PI / 2), glass(0xFFFFFF, { opacity: .14 })); lens.rotation.x = Math.PI / 2; lens.scale.z = .25; g.add(lens);
    const capsuleM = glass(0xF6D2C4, { opacity: .45 });
    const cup = M(new T.SphereGeometry(.34, 40, 20, 0, TAU, Math.PI * .35, Math.PI * .65), capsuleM); cup.position.y = .05; g.add(cup);
    const knot = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 3; knot.push([Math.cos(a) * .17 + Math.cos(a * 2.3) * .06, .12 + Math.sin(a * 1.7) * .1, Math.sin(a) * .17 * .3]) }
    g.add(tube(knot, .028, phys(0xD0353A, { roughness: .35, clearcoat: .7 }), true, 160));
    const tubule = tube([[0, -.27, 0], [.02, -.38, 0], [-.03, -.5, 0]], .05, glass(0xF6D2C4, { opacity: .5 })); g.add(tubule);
    const parts = [];
    for (let i = 0; i < 10; i++) { const p = M(new T.SphereGeometry(.026, 10, 8), std(0x8F9A9E)); p.userData = { o: i / 10, x: (Math.random() - .5) * .3, pr: false }; g.add(p); parts.push(p) }
    for (let i = 0; i < 5; i++) { const p = M(new T.SphereGeometry(.055, 16, 12), phys(0xF2C230, { emissive: 0x6b5200, emissiveIntensity: .3 })); p.userData = { o: i / 5 + .07, x: (Math.random() - .5) * .26, pr: true }; g.add(p); parts.push(p) }
    return {
      group: g, update(t, leak) {
        parts.forEach(p => { const u = p.userData; const ph = (t * .28 + u.o) % 1; let y = .42 - ph * .95; if (u.pr && !leak) y = Math.max(y, .2 + .03 * Math.sin(t * 3 + u.o * 9)); p.position.set(u.x * (y < -.2 ? .25 : 1) + Math.sin(t + u.o * 7) * .02, y, .04); p.visible = y > -.55 })
      }
    };
  }

  /* ===================== models ===================== */
  const MODELS = {
    /* 1 — blood sugar: a vessel cut-away with red cells and sugar crystals, glucose meter reading 235 */
    drop() {
      const g = new T.Group();
      const wall = M(new T.CylinderGeometry(.5, .5, 2.3, 48, 1, true, 0, Math.PI * 1.25), gloss(0xE58C88, { roughness: .35, clearcoat: .8, side: T.DoubleSide, transparent: true, opacity: .55, depthWrite: false }));
      wall.rotation.z = Math.PI / 2; wall.rotation.x = -.3; wall.position.y = .78; g.add(wall);
      const inner = M(new T.CylinderGeometry(.47, .47, 2.3, 64, 1, true), new T.MeshPhysicalMaterial({ color: 0x8E1E26, roughness: .6, side: T.BackSide })); inner.rotation.z = Math.PI / 2; inner.position.y = .78; g.add(inner);
      [-1, 1].forEach(s => { const rim = M(new T.TorusGeometry(.485, .03, 12, 64), phys(0xD96B6B, { roughness: .3 })); rim.rotation.y = Math.PI / 2; rim.position.set(s * 1.15, .78, 0); g.add(rim) });
      const rbcGeo = new T.LatheGeometry([[0, .03], [.06, .045], [.11, .05], [.135, .03], [.14, 0], [.135, -.03], [.11, -.05], [.06, -.045], [0, -.03]].map(([x, y]) => new T.Vector2(x, y)), 28);
      const rbcM = phys(0xC8202E, { roughness: .35, clearcoat: .6 }); const sugarM = phys(0xFFFFFF, { roughness: .25, clearcoat: 1, transparent: true, opacity: .95 });
      const flow = [];
      for (let i = 0; i < 9; i++) { const r = M(rbcGeo, rbcM); r.userData = { kind: 'rbc', o: i / 9, y: (Math.random() - .5) * .5, z: (Math.random() - .5) * .5, s: Math.random() * TAU }; g.add(r); flow.push(r) }
      for (let i = 0; i < 16; i++) { const c = rbox(.12, .12, .12, .025, sugarM); c.userData = { kind: 'sugar', o: i / 16 + .03, y: (Math.random() - .5) * .6, z: (Math.random() - .5) * .6, s: Math.random() * TAU }; g.add(c); flow.push(c) }
      // glucose meter
      const meter = new T.Group(); meter.position.set(.95, .62, .55); meter.rotation.set(-.25, -.45, 0); g.add(meter);
      meter.add(rbox(.42, .66, .1, .07, phys(0x2F3A40, { roughness: .35, clearcoat: .7 })));
      const scr = textCard(.32, .26, (c, w, h) => { c.fillStyle = '#E8F2EC'; c.fillRect(0, 0, w, h); c.fillStyle = '#C8313C'; c.font = `600 ${h * .52}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('235', w / 2, h * .44); c.fillStyle = '#17242A'; c.font = `500 ${h * .17}px ${FONT}`; c.fillText('mg/dL', w / 2, h * .82) }, { px: 256, depth: .01, r: .02 });
      scr.position.set(0, .12, .052); meter.add(scr);
      const btn = M(new T.CylinderGeometry(.05, .05, .02, 24), std(C.teal)); btn.rotation.x = Math.PI / 2; btn.position.set(0, -.18, .055); meter.add(btn);
      const strip = rbox(.07, .2, .01, .005, std(0xFFFFFF)); strip.position.set(0, .4, 0); meter.add(strip);
      const title = label('น้ำตาลในเลือดสูง', { h: .24, color: '#B3202C', dot: '#C8202E' }); title.position.set(0, 1.92, 0); g.add(title);
      const c1 = callout('เม็ดเลือดแดง', V(-.55, .8, .2), V(-.62, 1.45, .3), { dot: '#C8202E', h: .2 }); const c2 = callout('น้ำตาล', V(.3, .7, .3), V(.42, 1.45, .4), { dot: '#9AA', h: .2 }); g.add(c1, c2);
      const organs = ['eye', 'kidney', 'heart', 'vessel', 'nerve'], on = ['ตา', 'ไต', 'หัวใจ', 'หลอดเลือด', 'เส้นประสาท'];
      const og = organs.map((n, i) => { const grp = new T.Group(); const ic = iconSprite(n, .42, { bg: '#C8313C' }); grp.add(ic); const l = label(on[i], { h: .16 }); l.position.y = -.33; grp.add(l); grp.scale.setScalar(.001); g.add(grp); return grp });
      let show = 0, sT = 0;
      return {
        group: g, baseY: .1, spin: false,
        fx(k) { if (k === 'organs') show = 1 },
        update(t, dt) {
          flow.forEach(f => { const u = f.userData; const ph = (t * .12 + u.o) % 1; const x = -1.1 + ph * 2.2; f.position.set(x, .78 + u.y * .75 + Math.sin(t + u.s) * .03, u.z * .75); f.rotation.set(t * .6 + u.s, t * .4 + u.s, u.kind === 'rbc' ? Math.PI / 2 : 0); const edge = Math.min(1, Math.min(ph, 1 - ph) * 12); f.scale.setScalar(edge) });
          sT = lerp(sT, show, Math.min(1, dt * 2.5)); c1.userData.fade(1 - sT); c2.userData.fade(1 - sT);
          og.forEach((o, i) => { const a = Math.PI * (.15 + .7 * i / 4); o.position.set(-Math.cos(a) * 1.25, 1.35 + Math.sin(a) * .35, .3); o.scale.setScalar(Math.max(.001, ease(Math.min(1, Math.max(0, sT * 1.6 - i * .12))))) });
        }
      };
    },

    /* 2 — healthy plate: half vegetables, quarter brown rice, quarter fish & tofu; fruit bowl and water on the side */
    plate() {
      const g = new T.Group(); const P = {};
      const plateProf = [[0, 0], [.7, 0], [.74, .015], [.86, .05], [1.02, .1], [1.08, .13], [1.06, .145], [.98, .125], [.84, .085], [.7, .055], [0, .055]].map(([x, y]) => new T.Vector2(x, y));
      const plate = M(new T.LatheGeometry(plateProf, 72), gloss(0xFBFAF6, { roughness: .2, clearcoat: 1 })); g.add(plate);
      const rim = M(new T.TorusGeometry(1.07, .008, 6, 96), std(C.teal)); rim.rotation.x = Math.PI / 2; rim.position.y = .14; g.add(rim);
      const R = .82;
      function zone(a0, a1) { const grp = new T.Group(); const mid = (a0 + a1) / 2; grp.userData = { a: mid, base: V(0, .06, 0) }; grp.position.copy(grp.userData.base); g.add(grp); return grp }
      const inSector = (a0, a1, rMin = .12, rMax = R) => { const a = a0 + Math.random() * (a1 - a0), r = rMin + Math.sqrt(Math.random()) * (rMax - rMin); return [Math.cos(a) * r, -Math.sin(a) * r] };
      // vegetables (left half): broccoli florets, carrot coins, leafy greens
      P.veg = zone(Math.PI / 2, Math.PI * 1.5);
      const stem = phys(0x9CC46A, { roughness: .55 }), flor = surfaceMat('floret', { base: 0x3E8A3A, dark: 0x1F5A22, light: 0x6DB353, scale: 14, bump: 2.5 }), carrot = phys(0xF07A2A, { roughness: .4, clearcoat: .4 }), leaf = phys(0x58A645, { roughness: .5, side: T.DoubleSide });
      for (let i = 0; i < 9; i++) {
        const [x, z] = inSector(Math.PI * .58, Math.PI * 1.42, .25, .74); const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = Math.random() * TAU; P.veg.add(b);
        const st = M(new T.CylinderGeometry(.03, .045, .14, 10), stem); st.position.y = .07; b.add(st);
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, r = k ? .055 : 0; const f = M(new T.SphereGeometry(.06 + Math.random() * .015, 16, 12), flor); f.position.set(Math.cos(a) * r, .17 + (k ? 0 : .02), Math.sin(a) * r); b.add(f) }
      }
      for (let i = 0; i < 6; i++) { const [x, z] = inSector(Math.PI * .6, Math.PI * 1.4, .2, .7); const c = M(new T.CylinderGeometry(.075, .075, .025, 20), carrot); c.position.set(x, .04, z); c.rotation.set(Math.random() * .4, 0, Math.random() * .4); P.veg.add(c) }
      for (let i = 0; i < 5; i++) { const [x, z] = inSector(Math.PI * .6, Math.PI * 1.4, .15, .55); const l = M(new T.SphereGeometry(.14, 16, 10, 0, TAU, 0, Math.PI * .35), leaf); l.scale.set(1, .35, .6); l.position.set(x, .03, z); l.rotation.y = Math.random() * TAU; P.veg.add(l) }
      // brown rice (back-right quarter)
      P.rice = zone(0, Math.PI / 2);
      const mound = M(new T.SphereGeometry(.42, 40, 20, 0, TAU, 0, Math.PI / 2), surfaceMat('rice', { base: 0xC69C6D, dark: 0x8C6644, light: 0xE6C9A2, scale: 26, bump: 3 })); mound.scale.set(1, .42, 1); mound.position.set(.42, 0, -.42); P.rice.add(mound);
      const grain = new T.InstancedMesh(new T.CapsuleGeometry(.014, .03, 3, 6), phys(0xB98A5A, { roughness: .5 }), 140); const dm = new T.Object3D();
      for (let i = 0; i < 140; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * .4; const y = Math.sqrt(Math.max(0, 1 - (r / .42) ** 2)) * .176; dm.position.set(.42 + Math.cos(a) * r, y + .01, -.42 + Math.sin(a) * r); dm.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); dm.updateMatrix(); grain.setMatrixAt(i, dm.matrix) }
      P.rice.add(grain);
      // protein (front-right quarter): steamed fish + tofu
      P.prot = zone(-Math.PI / 2, 0);
      const fishShape = new T.Shape(); fishShape.moveTo(-.34, 0); fishShape.bezierCurveTo(-.2, .16, .15, .17, .3, .04); fishShape.lineTo(.42, .12); fishShape.lineTo(.4, -.12); fishShape.lineTo(.3, -.04); fishShape.bezierCurveTo(.15, -.17, -.2, -.16, -.34, 0);
      const fishGeo = new T.ExtrudeGeometry(fishShape, { depth: .06, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 4, curveSegments: 24 }); fishGeo.rotateX(-Math.PI / 2);
      const fish = M(fishGeo, phys(0xF2E3CF, { roughness: .45, clearcoat: .5 })); fish.position.set(.42, .04, .38); fish.rotation.y = .6; P.prot.add(fish);
      for (let i = 0; i < 4; i++) { const sc = M(new T.CylinderGeometry(.004, .004, .18, 6), std(0xD9B98E)); sc.rotation.z = Math.PI / 2; sc.rotation.y = .6 + .7; sc.position.set(.32 + i * .07, .14, .32 + i * .05); P.prot.add(sc) }
      [[.22, .64], [.36, .7], [.52, .62]].forEach(([x, z], i) => { const tf = rbox(.13, .1, .13, .02, phys(0xFBF3DA, { roughness: .55, clearcoat: .2 })); tf.position.set(x, .06, z); tf.rotation.y = i * .5; P.prot.add(tf) });
      const herb = phys(0x5DAA48); for (let i = 0; i < 6; i++) { const h = M(new T.SphereGeometry(.02, 8, 6), herb); h.position.set(.35 + Math.random() * .2, .14, .3 + Math.random() * .15); P.prot.add(h) }
      // fruit bowl beside the plate (on the stage, not floating)
      P.fruit = new T.Group(); P.fruit.position.set(-.95, 0, .85); P.fruit.userData = { base: P.fruit.position.clone() }; g.add(P.fruit);
      const bowl = M(new T.LatheGeometry([[0, 0], [.18, 0], [.26, .08], [.3, .16], [.28, .17], [.24, .1], [.16, .04], [0, .04]].map(([x, y]) => new T.Vector2(x, y)), 48), phys(0x2E9B7E, { roughness: .3, clearcoat: .8 })); P.fruit.add(bowl);
      const guava = M(new T.SphereGeometry(.1, 24, 16), phys(0x9BC45A, { roughness: .5 })); guava.position.set(-.06, .16, 0); P.fruit.add(guava);
      const guavaCut = M(new T.CircleGeometry(.095, 24), phys(0xF6A7A0, { roughness: .6 })); guavaCut.position.set(.07, .2, .04); guavaCut.rotation.set(-1.1, .3, 0); P.fruit.add(guavaCut);
      const rose = M(new T.LatheGeometry([[0, 0], [.06, .01], [.09, .06], [.08, .13], [.04, .17], [0, .17]].map(([x, y]) => new T.Vector2(x, y)), 24), phys(0xE2547A, { roughness: .3, clearcoat: .8 })); rose.position.set(.08, .1, -.06); rose.rotation.z = .4; P.fruit.add(rose);
      // water glass
      const glassG = new T.Group(); glassG.position.set(-1.08, 0, -.45); g.add(glassG);
      glassG.add(M(new T.CylinderGeometry(.13, .11, .42, 32, 1, true), glass(0xFFFFFF, { opacity: .25, side: T.DoubleSide })));
      const water = M(new T.CylinderGeometry(.118, .105, .3, 32), glass(0x9FD8F0, { opacity: .45 })); water.position.y = -.05; glassG.add(water); glassG.children.forEach(m => m.position.y += .21);
      const L = {
        veg: callout('ผัก ½ จาน', V(-.45, .25, 0), V(-1.0, .85, 0), { dot: '#3E8A3A', h: .22 }),
        rice: callout('ข้าวกล้อง ¼', V(.45, .2, -.45), V(.9, .9, -.4), { dot: '#B07A48', h: .22 }),
        prot: callout('ปลา เต้าหู้ ¼', V(.45, .15, .45), V(1.05, .55, .6), { dot: '#E0A060', h: .22 }),
        fruit: callout('ผลไม้ไม่หวานจัด', V(-.95, .3, .85), V(-.3, .12, 1.4), { dot: '#E2547A', h: .2 })
      };
      Object.values(L).forEach(l => g.add(l));
      let hi = null; const zoneOf = { veg: P.veg, rice: P.rice, prot: P.prot, fruit: P.fruit };
      return {
        group: g, spin: false, baseY: .14,
        fx(k) { hi = k },
        update(t, dt) {
          for (const k in zoneOf) { const z = zoneOf[k]; const on = hi === k; const by = (z.userData.base || V(0, 0, 0)).y; z.position.y = lerp(z.position.y, by + (on ? .2 : 0), Math.min(1, dt * 5)); const lab = L[k].children[0]; const s = on ? 1.25 + .05 * Math.sin(t * 5) : 1; lab.scale.copy(lab.userData.base).multiplyScalar(lerp(lab.scale.x / lab.userData.base.x, s, Math.min(1, dt * 6))) }
        }
      };
    },

    /* 3 — exercise: older adult demonstrating moves, with a chair for support */
    exercise() {
      const g = new T.Group(); const pp = person({ shirt: 0x8EC3E8, pants: 0x34445F, hair: 'bun', scale: 1.22 }); g.add(pp.group); pp.group.position.z = .1;
      const mat = rbox(1.6, .03, .9, .015, fabric(0x7FC7B1)); mat.position.y = .015; g.add(mat);
      const chair = chairMesh(); chair.scale.setScalar(.001); g.add(chair);
      const head1 = label('30 นาที / วัน', { h: .3, color: '#1D7262', fs: 52, dot: '#2E9B7E' }); head1.position.set(0, 2.86, 0); g.add(head1);
      const sub = label('อย่างน้อย 5 วันต่อสัปดาห์', { h: .2 }); sub.position.set(0, 2.42, 0); g.add(sub);
      const { hips, spine, lS, lE, rS, rE, lT, lK, lF, rT, rK, rF } = pp;
      const BASE = { hy: .97, hz: 0, sx: .04, sz: 0, lSx: 0, lSz: -.1, rSx: 0, rSz: .1, lEx: -.08, rEx: -.08, lTx: 0, rTx: 0, lKx: 0, rKx: 0, lFx: 0, rFx: 0 };
      const L = (a, b, t) => a + (b - a) * t, wave = ph => (1 - Math.cos(ph * Math.PI * 2)) / 2;
      const POSES = {
        stand(ph, c, t) { return { sx: .04 + .02 * Math.sin(t * 1.5), lSz: -.12, rSz: .12 } },
        march(ph) { const s = Math.sin(ph * Math.PI * 2), a = Math.max(0, s), b = Math.max(0, -s); return { lTx: -.95 * a, lKx: 1.4 * a, rTx: -.95 * b, rKx: 1.4 * b, lFx: .25 * a, rFx: .25 * b, lSx: .5 * s, rSx: -.5 * s, lEx: -.55, rEx: -.55, hy: .97 + .015 * (a + b) } },
        swing(ph) { const s = Math.sin(ph * Math.PI * 2), bo = (1 - Math.cos(ph * Math.PI * 4)) / 2; return { lSx: -.95 * s, rSx: -.95 * s, lEx: -.15, rEx: -.15, lKx: .32 * bo, rKx: .32 * bo, lTx: -.16 * bo, rTx: -.16 * bo, lFx: -.16 * bo, rFx: -.16 * bo, hy: .97 - .035 * bo } },
        raise(ph) { const e = wave(ph); return { lSz: -(.1 + 2.75 * e), rSz: .1 + 2.75 * e, lEx: 0, rEx: 0, sx: -.03 * e } },
        kick(ph, c) { const e = Math.min(1, Math.sin(ph * Math.PI) * 1.35); const o = { hy: .62, hz: -.13, lTx: -1.5, rTx: -1.5, lKx: 1.5, rKx: 1.5, lSx: -.55, rSx: -.55, lEx: -.8, rEx: -.8, lSz: -.18, rSz: .18, sx: -.02 }; if (c % 2 === 0) { o.lKx = 1.5 - 1.38 * e; o.lFx = -.35 * e } else { o.rKx = 1.5 - 1.38 * e; o.rFx = -.35 * e } return o },
        sitstand(ph) { const e = wave(ph); return { hy: L(.62, .97, e), hz: L(-.13, 0, e), lTx: L(-1.5, 0, e), rTx: L(-1.5, 0, e), lKx: L(1.5, 0, e), rKx: L(1.5, 0, e), sx: .55 * Math.sin(Math.PI * e) + .06 * (1 - e), lSx: -1.25, rSx: -1.25, lEx: -.1, rEx: -.1 } },
        heel(ph) { const e = wave(ph); return { hy: .97 + .075 * e, lFx: .5 * e, rFx: .5 * e, rSz: .44, rSx: -.25, rEx: -.3, lSz: -.14, lEx: -.1 } },
        stretch(ph, c) { const e = wave(ph); return c % 2 === 0 ? { rSz: .1 + 2.6 * e, sz: .3 * e, lSz: -.12 - .18 * e, rEx: 0 } : { lSz: -(.1 + 2.6 * e), sz: -.3 * e, rSz: .12 + .18 * e, lEx: 0 } }
      };
      const seated = { kick: 1, sitstand: 1 }; let pulse = 0;
      return {
        group: g, spin: false, baseY: .12, noBob: true,
        fx(k) { if (k === 'days') pulse = 2.4 },
        update(t, dt) {
          let ph, c, pose; const VCH = E.getVCH();
          if (VID.on) { pose = VCH[VID.ch].pose; if (VID.mode === 'count') { const el = ((VID.playing ? performance.now() : VID.pausedAt) - VID.cStart) / E.COUNT_MS; ph = Math.min(.999, Math.max(0, el)); c = VID.count } else { const per = 3.2; ph = VID.playing ? (t / per) % 1 : 0; c = Math.floor(t / per) } }
          else { pose = 'march'; ph = (t / 2.2) % 1; c = 0 }
          const tg = Object.assign({}, BASE, POSES[pose](ph, c, t)); const k = Math.min(1, dt * 12);
          hips.position.y = L(hips.position.y || .97, tg.hy, k); hips.position.z = L(hips.position.z, tg.hz, k);
          spine.rotation.x = L(spine.rotation.x, tg.sx, k); spine.rotation.z = L(spine.rotation.z, tg.sz, k);
          lS.rotation.x = L(lS.rotation.x, tg.lSx, k); lS.rotation.z = L(lS.rotation.z, tg.lSz, k); rS.rotation.x = L(rS.rotation.x, tg.rSx, k); rS.rotation.z = L(rS.rotation.z, tg.rSz, k);
          lE.rotation.x = L(lE.rotation.x, tg.lEx, k); rE.rotation.x = L(rE.rotation.x, tg.rEx, k);
          lT.rotation.x = L(lT.rotation.x, tg.lTx, k); rT.rotation.x = L(rT.rotation.x, tg.rTx, k); lK.rotation.x = L(lK.rotation.x, tg.lKx, k); rK.rotation.x = L(rK.rotation.x, tg.rKx, k);
          lF.rotation.x = L(lF.rotation.x, tg.lFx, k); rF.rotation.x = L(rF.rotation.x, tg.rFx, k);
          const cs = VID.on ? 1 : 0; chair.scale.setScalar(Math.max(.001, L(chair.scale.x, cs, Math.min(1, dt * 5))));
          const sit = !!seated[pose]; chair.position.x = L(chair.position.x, sit ? 0 : .7, Math.min(1, dt * 5)); chair.position.z = L(chair.position.z, sit ? -.05 : .1, Math.min(1, dt * 5)); chair.rotation.y = L(chair.rotation.y, sit ? 0 : Math.PI / 2, Math.min(1, dt * 5));
          const lv = VID.on ? 0 : 1;[head1, sub].forEach(l => { l.material.opacity = L(l.material.opacity, lv, Math.min(1, dt * 6)) });
          const pz = pulse > 0 ? 1.15 + .08 * Math.sin(t * 8) : 1; head1.scale.copy(head1.userData.base).multiplyScalar(pz); pulse = Math.max(0, pulse - dt);
          pp.mood('happy'); pp.tick(t, dt);
        }
      };
    },

    /* 4 — medicines: weekly pill organizer (morning / noon / evening / bedtime) with a clock and a prescription bottle */
    meds() {
      const g = new T.Group();
      const box = new T.Group(); box.position.set(-.02, .06, .15); box.rotation.x = -.05; g.add(box);
      const rows = ['เช้า', 'กลางวัน', 'เย็น', 'ก่อนนอน'], rowC = [0xF2B544, 0xF08A4B, 0x6CA6D9, 0x6C6BB3], days = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
      const cw = .24, chh = .2;
      const OX = .2; // compartments shift right to leave room for the printed row names
      const shell = rbox(cw * 7 + .5, .12, chh * 4 + .32, .04, phys(0xF4F1EA, { roughness: .35, clearcoat: .6 })); shell.position.x = -OX + .02; box.add(shell);
      const side = textCard(.38, chh * 4, (c, w, h) => { c.fillStyle = '#F4F1EA'; c.fillRect(0, 0, w, h); c.textAlign = 'center'; c.textBaseline = 'middle'; rows.forEach((r, i) => { const y = (i + .5) * h / 4; c.fillStyle = '#' + rowC[i].toString(16).padStart(6, '0'); rr(c, w * .06, y - h * .1, w * .88, h * .2, 16); c.fill(); c.fillStyle = '#FFFFFF'; c.font = `600 ${h * .11}px ${FONT}`; c.fillText(r, w / 2, y + 2) }) }, { px: 300, depth: .01, r: .02 });
      side.rotation.x = -Math.PI / 2; side.position.set(-cw * 3.5 - OX + .02, .066, .09); box.add(side);
      const pillC = [0xFFFFFF, 0xF4D03F, 0xE0614E, 0x7FB2E0];
      const lids = [];
      rows.forEach((r, ri) => days.forEach((d, di) => {
        const x = (di - 3) * cw + .0, z = (ri - 1.5) * chh + .09;
        const lid = rbox(cw - .025, .03, chh - .025, .02, phys(rowC[ri], { roughness: .2, clearcoat: 1, transparent: true, opacity: .62 })); lid.position.set(x, .075, z); box.add(lid); lids.push({ lid, ri, di });
        const pill = M(new T.CapsuleGeometry(.022, .04, 4, 10), phys(pillC[(ri + di) % 4], { roughness: .3, clearcoat: .8 })); pill.rotation.z = Math.PI / 2; pill.rotation.y = (di + ri) * .7; pill.position.set(x, .05, z); box.add(pill);
      }));
      const hdr = textCard(cw * 7, .14, (c, w, h) => { c.fillStyle = '#1D7262'; c.fillRect(0, 0, w, h); c.fillStyle = '#FFF'; c.font = `500 ${h * .56}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; days.forEach((d, i) => c.fillText(d, (i + .5) * w / 7, h * .54)) }, { px: 700, depth: .02 });
      hdr.rotation.x = -Math.PI / 2; hdr.position.set(0, .07, -chh * 2 + .02); box.add(hdr);
      // clock
      const clock = new T.Group(); clock.position.set(.62, .92, -.45); g.add(clock);
      const dial = M(new T.CylinderGeometry(.46, .46, .08, 64), phys(0xFFFFFF, { roughness: .3, clearcoat: .7 })); dial.rotation.x = Math.PI / 2; clock.add(dial);
      const bez = M(new T.TorusGeometry(.47, .045, 16, 72), phys(C.teal, { roughness: .25, clearcoat: 1 })); clock.add(bez);
      const numC = canvas(512, 512); { const c = numC.getContext('2d'); c.fillStyle = '#FFF'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#17242A'; c.font = `500 58px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU; c.fillText(String(i), 256 + Math.sin(a) * 196, 256 - Math.cos(a) * 196) } for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, r0 = i % 5 ? 236 : 226; c.strokeStyle = '#17242A'; c.lineWidth = i % 5 ? 2 : 5; c.beginPath(); c.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0); c.lineTo(256 + Math.sin(a) * 246, 256 - Math.cos(a) * 246); c.stroke() } }
      const faceM = M(new T.CircleGeometry(.43, 64), new T.MeshStandardMaterial({ map: ctex(numC), roughness: .5 })); faceM.position.z = .042; clock.add(faceM);
      const hp = new T.Group(), mp = new T.Group(); hp.position.z = mp.position.z = .05; clock.add(hp, mp);
      const hh = rbox(.035, .22, .015, .012, std(C.ink)); hh.position.y = .09; hp.add(hh); const mh = rbox(.025, .32, .015, .01, std(C.ink)); mh.position.y = .14; mp.add(mh);
      const hub = M(new T.CylinderGeometry(.035, .035, .03, 20), std(C.coral)); hub.rotation.x = Math.PI / 2; hub.position.z = .065; clock.add(hub);
      const leg = rbox(.08, .45, .06, .03, phys(C.teal)); leg.position.set(0, -.62, -.05); clock.add(leg);
      const foot = M(new T.CylinderGeometry(.22, .25, .05, 40), phys(C.teal)); foot.position.set(0, -.86, -.05); clock.add(foot);
      hp.rotation.z = -TAU * 8 / 12; mp.rotation.z = 0;
      // prescription bottle
      const bottle = new T.Group(); bottle.position.set(-1.0, 0, -.55); g.add(bottle);
      const bod = M(new T.CylinderGeometry(.17, .17, .42, 40), phys(0xE8902E, { roughness: .15, clearcoat: 1, transparent: true, opacity: .85 })); bod.position.y = .21; bottle.add(bod);
      const capB = M(new T.CylinderGeometry(.185, .185, .09, 40), phys(0xFFFFFF, { roughness: .4 })); capB.position.y = .465; bottle.add(capB);
      const lblC = canvas(512, 256); { const c = lblC.getContext('2d'); c.fillStyle = '#FFF'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#1D7262'; c.fillRect(0, 0, 512, 56); c.fillStyle = '#FFF'; c.font = `500 36px ${FONT}`; c.textAlign = 'center'; c.fillText('ยาตามแพทย์สั่ง', 256, 40); c.fillStyle = '#17242A'; c.font = `500 34px ${BODY}`; c.fillText('ครั้งละ 1 เม็ด', 256, 120); c.fillText('หลังอาหาร เช้า-เย็น', 256, 176) }
      const lbl = M(new T.CylinderGeometry(.172, .172, .24, 40, 1, true, -Math.PI * .45, Math.PI * .9), new T.MeshStandardMaterial({ map: ctex(lblC), roughness: .6 })); lbl.position.y = .22; bottle.add(lbl);
      const title = label('กินยาตรงเวลา ตรงขนาด', { h: .24, color: '#1D7262', dot: '#2E9B7E' }); title.position.set(0, 1.95, 0); g.add(title);
      let fast = 0, big = 0, bigT = 0, hi = 0;
      return {
        group: g, spin: false, baseY: .14,
        fx(k) { if (k === 'clock') fast = 2.2; if (k === 'pill') big = 2.5 },
        update(t, dt) {
          const sp = fast > 0 ? 5 : .06; mp.rotation.z -= dt * sp; hp.rotation.z -= dt * sp / 12; fast = Math.max(0, fast - dt);
          bigT = lerp(bigT, big > 0 ? 1 : 0, Math.min(1, dt * 4)); big = Math.max(0, big - dt); bottle.scale.setScalar(1 + bigT * .45); bottle.position.z = -.55 + bigT * .6; bottle.rotation.y = Math.sin(t) * .2;
          const row = Math.floor((t / 1.6) % 4); lids.forEach(o => { const on = o.ri === row; o.lid.position.y = lerp(o.lid.position.y, on ? .13 : .075, Math.min(1, dt * 6)); o.lid.rotation.x = lerp(o.lid.rotation.x, on ? -.5 : 0, Math.min(1, dt * 6)) });
        }
      };
    },

    /* 5 — SKT 1 breathing: seated older adult, palms up on the lap; in for 3, out for 5 */
    mind() {
      const g = new T.Group(); const ch = chairMesh(); g.add(ch); ch.position.z = -.1;
      const pp = person({ shirt: 0xF3EFE6, pants: 0xF3EFE6, collar: 0xFFFFFF, hair: 'bun', skirt: false }); g.add(pp.group);
      const { hips, spine, lS, lE, rS, rE, lT, lK, rT, rK, lH, rH, head } = pp;
      hips.position.set(0, .62, -.13); lT.rotation.x = rT.rotation.x = -1.5; lK.rotation.x = rK.rotation.x = 1.5; spine.rotation.x = 0;
      lS.rotation.set(-.35, 0, -.18); rS.rotation.set(-.35, 0, .18); lE.rotation.x = rE.rotation.x = -.9; lH.rotation.x = rH.rotation.x = Math.PI * .45; pp.closeEyes(true); pp.mood('happy');
      const ring = M(new T.TorusGeometry(.95, .02, 12, 120), new T.MeshBasicMaterial({ color: 0x5BE3B5, transparent: true, opacity: .8, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = .05; g.add(ring);
      const aura = M(new T.SphereGeometry(.9, 48, 32), new T.MeshBasicMaterial({ color: 0x9FF0D6, transparent: true, opacity: .1, depthWrite: false, toneMapped: false })); aura.position.y = 1.1; g.add(aura);
      const motes = []; for (let i = 0; i < 26; i++) { const m = M(new T.SphereGeometry(.018, 8, 6), new T.MeshBasicMaterial({ color: 0xE9FFF6, transparent: true, toneMapped: false })); m.userData = { a: Math.random() * TAU, y: Math.random() * 1.6 + .3, r: .9 + Math.random() * .4 }; g.add(m); motes.push(m) }
      const lab = label('หายใจเข้า', { h: .3, color: '#1D7262', fs: 52 }); lab.position.set(0, 2.6, 0); g.add(lab); let last = '';
      const sub = label('SKT ท่าที่ 1 นั่งผ่อนคลาย', { h: .17 }); sub.position.set(0, 2.05, 0); g.add(sub);
      return {
        group: g, spin: false, baseY: .12,
        update(t, dt) {
          const cyc = 8, p = t % cyc; const inh = p < 3; const k = inh ? (p / 3) : 1 - (p - 3) / 5; const e = .5 - .5 * Math.cos(k * Math.PI);
          spine.scale.set(1 + .035 * e, 1 + .02 * e, 1 + .06 * e); spine.rotation.x = -.03 * e; head.rotation.x = -.06 * e; lS.rotation.z = -.18 - .04 * e; rS.rotation.z = .18 + .04 * e;
          ring.scale.setScalar(.75 + .45 * e); ring.material.opacity = .35 + .5 * e; aura.scale.setScalar(.8 + .35 * e);
          const n = inh ? Math.min(3, Math.floor(p) + 1) : Math.min(5, Math.floor(p - 3) + 1); const txt = inh ? `หายใจเข้า… ${n}` : `หายใจออก… ${n}`; if (txt !== last) { lab.set(txt, { color: inh ? '#1D7262' : '#3E6FC7' }); last = txt }
          motes.forEach(m => { const u = m.userData; const r = u.r * (inh ? 1 - .35 * e : .65 + .35 * (1 - e)); m.position.set(Math.cos(u.a + t * .2) * r, u.y + Math.sin(t + u.a) * .05, Math.sin(u.a + t * .2) * r) });
        }
      };
    },

    /* 6 — kidney cut open: cortex, medulla pyramids, renal pelvis; magnifier shows the glomerular filter */
    kidney() {
      const outer = new T.Group(); const g = new T.Group(); outer.add(g); g.scale.setScalar(.86); g.position.x = .12;
      const k = kidneyModel({ cut: true }); k.group.position.set(-.35, 1.05, 0); k.group.scale.setScalar(.82); k.group.rotation.y = .25; g.add(k.group);
      const glom = glomerulus(); glom.group.position.set(1.0, 1.2, .2); glom.group.scale.setScalar(.82); g.add(glom.group);
      const toK = (x, y, z) => V(-.35 + x * .82, 1.05 + y * .82, z * .82);
      const hx = k.hilumX;
      const C1 = callout('หลอดเลือดแดง', toK(hx - .7, .3, 0), V(-1.25, 2.0, 0), { dot: '#D0353A', h: .23 });
      const C2 = callout('หลอดเลือดดำ', toK(hx - .8, .09, 0), V(-1.32, .62, 0), { dot: '#3E6FC7', h: .23 });
      const C3 = callout('ท่อไต', toK(hx - .14, -.85, 0), V(-1.0, .2, 0), { dot: '#E3BE7E', h: .23 });
      const C4 = callout('เนื้อไตชั้นนอก', toK(.55, .55, .05), V(.62, 2.3, .1), { dot: '#B4473C', h: .23 });
      g.add(C1, C2, C3, C4);
      const lab = label('ไตปกติ', { h: .27, color: '#1D7262', dot: '#2E9B72' }); lab.position.set(-.45, 2.72, 0); g.add(lab);
      const gl = label('ตัวกรองในไต (ขยาย)', { h: .2, color: '#1D7262' }); gl.position.set(1.0, .5, .2); g.add(gl);
      const l1 = label('ของเสีย', { h: .19, dot: '#8F9A9E' }); l1.position.set(.6, .16, .2); g.add(l1);
      const l2 = label('โปรตีน', { h: .19, dot: '#F2C230' }); l2.position.set(1.42, .16, .2); g.add(l2);
      const lead = callout(' ', toK(.6, .1, .1), V(.5, 1.18, .2), { bg: 'none' }); g.add(lead);
      let st = -1;
      const self = {
        group: outer, spin: false, baseY: 0,
        sync() { if (st !== S.k) { st = S.k; k.setBad(!!S.k); lab.set(S.k ? 'ไตจากเบาหวาน' : 'ไตปกติ', { color: S.k ? '#A9501A' : '#1D7262', dot: S.k ? '#A9501A' : '#2E9B72' }); C4.children[0].set(S.k ? 'เนื้อไตบางลง มีแผลเป็น' : 'เนื้อไตชั้นนอก', { dot: '#B4473C' }) } },
        fx(f) { k.setFast(f === 'drip') },
        update(t, dt) { k.update(t, dt); k.group.rotation.y = .25 + Math.sin(t * .45) * .18; glom.update(t, !!S.k); glom.group.rotation.y = Math.sin(t * .3) * .12 }
      };
      self.sync(); return self;
    },

    /* 7 — eGFR: kidney beside a gauge dial with the six stage bands */
    egfr() {
      const g = new T.Group();
      const k = kidneyModel({ cut: false }); k.group.position.set(-.8, 1.0, -.1); k.group.scale.setScalar(.62); g.add(k.group);
      const dialG = new T.Group(); dialG.position.set(.42, .95, .1); g.add(dialG);
      dialG.add(rbox(1.9, 1.15, .08, .12, phys(0xFFFFFF, { roughness: .35, clearcoat: .7 })));
      const DC = canvas(1024, 620); const dtex = ctex(DC);
      const face = M(new T.PlaneGeometry(1.84, 1.11), new T.MeshStandardMaterial({ map: dtex, roughness: .55 })); face.position.z = .045; dialG.add(face);
      const toAng = v => Math.PI * (1 - Math.min(120, Math.max(0, v)) / 120);
      function drawDial(v, idx) {
        const c = DC.getContext('2d'), W = DC.width, H = DC.height, cx = W / 2, cy = H * .8, R = H * .66;
        c.clearRect(0, 0, W, H); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
        const bands = [[90, 120], [60, 90], [45, 60], [30, 45], [15, 30], [0, 15]];
        bands.forEach(([a, b], i) => { c.beginPath(); c.strokeStyle = STAGE_C[i]; c.lineWidth = R * .2; c.globalAlpha = i === idx ? 1 : .55; c.arc(cx, cy, R * .86, -toAng(a), -toAng(b), false); c.stroke(); c.globalAlpha = 1;
          const m = (a + b) / 2, an = toAng(m); c.fillStyle = '#FFFFFF'; c.font = `600 ${R * .1}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(STAGES[i][3], cx + Math.cos(an) * R * .86, cy - Math.sin(an) * R * .86) });
        c.fillStyle = '#4C595E'; c.font = `500 ${R * .075}px ${FONT}`;[0, 15, 30, 45, 60, 90, 120].forEach(n => { const an = toAng(n); c.fillText(String(n), cx + Math.cos(an) * R * 1.06, cy - Math.sin(an) * R * 1.06) });
        c.fillStyle = STAGE_C[idx]; c.font = `600 ${R * .3}px ${FONT}`; c.fillText(String(v), cx, cy - R * .32);
        c.fillStyle = '#17242A'; c.font = `500 ${R * .09}px ${FONT}`; c.fillText('eGFR  มล./นาที/1.73 ตร.ม.', cx, cy - R * .1);
        c.fillStyle = STAGE_C[idx]; c.font = `500 ${R * .11}px ${FONT}`; c.fillText(`ระยะ ${STAGES[idx][3]} · ${STAGES[idx][5]}`, cx, cy + R * .14);
        dtex.needsUpdate = true;
      }
      const needle = new T.Group(); needle.position.set(0, 1.11 * (.8 - .5) * -1, .08); dialG.add(needle);
      const nd = rbox(.03, .5, .02, .012, phys(C.ink, { roughness: .3 })); nd.position.y = .25; needle.add(nd);
      const hub = M(new T.CylinderGeometry(.05, .05, .04, 24), phys(C.coral)); hub.rotation.x = Math.PI / 2; needle.add(hub);
      // dial pivot sits at canvas (cx, cy) = (0.5W, 0.8H) → plane coords y = (0.5 - 0.8) * 1.11
      needle.position.set(0, (.5 - .8) * 1.11, .07);
      const stand = rbox(.5, .7, .1, .05, phys(C.teal)); stand.position.set(0, -.7, -.06); dialG.add(stand);
      let lastV = -1, ang = toAng(62);
      const self = {
        group: g, spin: false, baseY: .12,
        sync() { if (lastV === S.gfr) return; lastV = S.gfr; const i = stageIdx(S.gfr); k.setBad(S.gfr < 45); drawDial(S.gfr, i) },
        update(t, dt) { k.update(t, dt); k.group.rotation.y = Math.sin(t * .5) * .4; ang = lerp(ang, toAng(S.gfr), Math.min(1, dt * 5)); needle.rotation.z = ang - Math.PI / 2 }
      };
      self.sync(); return self;
    },

    /* 8 — ten ways to care for the kidneys: icon tokens orbit a kidney; tap one */
    care() {
      const g = new T.Group(); const k = kidneyModel({ cut: false }); k.group.scale.setScalar(.58); k.group.position.y = 1.0; g.add(k.group);
      const icons = ['meter', 'bp', 'salt', 'walk', 'glass', 'toilet', 'nosmoke', 'nopill', 'lab', 'family'];
      const tokens = [], pickables = [];
      icons.forEach((n, i) => { const sp = iconSprite(n, .42, { bg: '#1D7262', num: i + 1 }); sp.userData.pick = ['care', i]; g.add(sp); tokens.push(sp); pickables.push(sp);
        const sel = iconSprite(n, .42, { bg: '#E0A214', num: i + 1, ring: '#FFFFFF' }); sel.visible = false; sp.add(sel); sel.scale.set(1, 1, 1); sp.userData.sel = sel });
      const title = label(' ', { h: .2, maxW: 640, color: '#1D7262' }); title.position.set(0, 2.25, 0); g.add(title); let last = -1;
      const self = {
        group: g, spin: false, baseY: .1, pickables,
        sync() { if (last !== S.care) { last = S.care; title.set(`${S.care + 1}. ${CARE[S.care][0]}`) } },
        update(t, dt) {
          k.update(t, dt); k.group.rotation.y = t * .3;
          tokens.forEach((sp, i) => { const a = i / 10 * TAU + t * .12; const on = i === S.care; sp.position.set(Math.cos(a) * 1.2, 1.0 + Math.sin(a) * .5 + (on ? .1 : 0), Math.sin(a) * .6 + .2); const s = lerp(sp.scale.x / sp.userData.base.x, on ? 1.5 : 1, Math.min(1, dt * 6)); sp.scale.copy(sp.userData.base).multiplyScalar(s); sp.userData.sel.visible = on; sp.material.opacity = on ? 0 : 1 });
        }
      };
      self.sync(); return self;
    },

    /* 9 — six routines: a clipboard with icons and crisp text, ticked one by one */
    routine() {
      const g = new T.Group(); const board = new T.Group(); board.position.set(0, 1.12, 0); board.rotation.x = -.18; g.add(board);
      board.add(rbox(1.75, 2.15, .07, .08, phys(0xB98351, { roughness: .45, clearcoat: .6 })));
      const icons = ['meter', 'bowl', 'walk', 'pill', 'chart', 'lotus'];
      const short = ['คุมน้ำตาลและความดัน', 'กินอาหารให้เหมาะสม', 'ออกกำลังกาย คุมน้ำหนัก', 'ใช้ยาอย่างปลอดภัย', 'ติดตามการทำงานของไต', 'จัดการความเครียด'];
      const iconC = icons.map(n => iconCanvas(n, { size: 128 }));
      const paper = textCard(1.58, 1.95, (c, w, h, sel) => {
        c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#1D7262'; c.font = `500 ${h * .05}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('สิ่งที่ควรทำเป็นประจำ', w * .07, h * .1);
        c.fillStyle = '#DCE4E1'; c.fillRect(w * .07, h * .15, w * .86, 3);
        short.forEach((s, i) => {
          const y = h * (.24 + i * .127), on = i === sel, done = i <= sel;
          if (on) { c.fillStyle = '#FFF2C6'; rr(c, w * .04, y - h * .055, w * .92, h * .11, 18); c.fill() }
          c.drawImage(iconC[i], w * .07, y - h * .042, h * .084, h * .084);
          c.fillStyle = '#17242A'; c.font = `${on ? 600 : 500} ${h * .036}px ${BODY}`; c.fillText(`${i + 1}. ${s}`, w * .07 + h * .1, y);
          c.strokeStyle = done ? '#1D7262' : '#B9C6C1'; c.lineWidth = 6; rr(c, w * .84, y - h * .03, h * .06, h * .06, 8); c.stroke();
          if (done) { c.strokeStyle = '#1D7262'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * .84 + h * .012, y); c.lineTo(w * .84 + h * .027, y + h * .016); c.lineTo(w * .84 + h * .05, y - h * .018); c.stroke() }
        });
      }, { px: 900, depth: .015, r: .03 });
      paper.position.z = .045; board.add(paper);
      const clip = rbox(.6, .16, .1, .04, std(0x8C979B, { metalness: .7, roughness: .3 })); clip.position.set(0, 1.07, .06); board.add(clip);
      const ring = M(new T.TorusGeometry(.07, .018, 10, 24), std(0x8C979B, { metalness: .7, roughness: .3 })); ring.position.set(0, 1.16, .06); board.add(ring);
      const pickables = []; short.forEach((s, i) => { const hit = M(new T.PlaneGeometry(1.5, .24), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0, (.5 - (.24 + i * .127)) * 1.95, .07); hit.userData.pick = ['rt', i]; board.add(hit); pickables.push(hit) });
      const pen = new T.Group(); pen.position.set(.95, .45, .3); pen.rotation.set(.2, 0, -.9); g.add(pen);
      const pb = M(new T.CylinderGeometry(.035, .035, .7, 20), phys(C.teal, { roughness: .2, clearcoat: 1 })); pen.add(pb);
      const tip = M(new T.ConeGeometry(.035, .1, 20), std(0xD9D2C3)); tip.position.y = -.4; tip.rotation.x = Math.PI; pen.add(tip);
      let last = -1;
      return { group: g, spin: false, baseY: .1, pickables, update() { if (last !== S.rt) { last = S.rt; paper.userData.redraw(S.rt) } } };
    },

    /* 10 — six-step wheel with labels printed on the wedges */
    wheel() {
      const g = new T.Group(); const W = [0x1D7262, 0x2A8A74, 0x3AA187, 0x52B59A, 0x6FC4AC, 0x8ED2BE];
      const icons = ['target', 'chart', 'bulb', 'calendar', 'check', 'refresh'];
      const RAD = 1.25;
      // the text is white on a white canvas: tint it via the wedge colour by drawing wedge colour where no text
      const segs = [], pickables = [];
      for (let i = 0; i < 6; i++) {
        const a0 = Math.PI / 2 - i * Math.PI / 3 - .015, a1 = a0 - Math.PI / 3 + .03; const sh = new T.Shape(); sh.absarc(0, 0, RAD, a0, a1, true); sh.absarc(0, 0, .42, a1, a0, false);
        const geo = new T.ExtrudeGeometry(sh, { depth: .16, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 3, curveSegments: 40 }); geo.rotateX(-Math.PI / 2);
        const tN = makeTint(W[i], '#FFFFFF'), tS = makeTint(0xF2B544, '#3A2A05'); const cMat = new T.MeshStandardMaterial({ color: 0xFFFFFF, map: tN, roughness: .4 }), sMat = phys(W[i], { roughness: .4 });
        const m = M(geo, [cMat, sMat]); m.userData.pick = ['step', i]; pickables.push(m);
        const grp = new T.Group(); grp.add(m); const mid = (a0 + a1) / 2; grp.userData = { dir: V(Math.cos(mid), 0, -Math.sin(mid)), cMat, sMat, col: W[i], tN, tS }; g.add(grp); segs.push(grp);
      }
      function makeTint(col, ink) { // wedge colour background with its labels printed on top
        const c = canvas(1024, 1024), x = c.getContext('2d'); x.fillStyle = '#' + col.toString(16).padStart(6, '0'); x.fillRect(0, 0, 1024, 1024);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        for (let i = 0; i < 6; i++) { const mid = Math.PI / 2 - (i + .5) * Math.PI / 3; const r = .84 / (RAD * 2) * 1024; const px = 512 + Math.cos(mid) * r, py = 512 - Math.sin(mid) * r;
          const ic = iconCanvas(icons[i], { size: 160, bg: 'rgba(0,0,0,0)', fg: ink }); x.drawImage(ic, px - 60, py - 128, 120, 120);
          x.fillStyle = ink; x.font = `700 62px ${FONT}`; x.fillText(`${i + 1} ${STEPW[i]}`, px, py + 30) }
        const t = ctex(c); t.repeat.set(1 / (RAD * 2), 1 / (RAD * 2)); t.offset.set(.5, .5); return t;
      }
      const hub = M(new T.CylinderGeometry(.4, .4, .26, 64), phys(0xFFFFFF, { roughness: .3, clearcoat: .8 })); hub.position.y = .13; g.add(hub);
      const hubC = canvas(512, 512); { const c = hubC.getContext('2d'); c.fillStyle = '#FFF'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#1D7262'; c.font = `600 120px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('6 ทำ', 256, 210); c.fillStyle = '#17242A'; c.font = `500 56px ${FONT}`; c.fillText('จำง่าย', 256, 330) }
      const hubTop = M(new T.CircleGeometry(.39, 64), new T.MeshStandardMaterial({ map: ctex(hubC), roughness: .5 })); hubTop.rotation.x = -Math.PI / 2; hubTop.position.y = .262; g.add(hubTop);
      const lab = label(' ', { h: .22, color: '#1D7262', maxW: 640 }); lab.position.set(0, 1.25, -.4); g.add(lab); let last = -1;
      const gold = lin(0xF2B544);
      const self = {
        group: g, spin: false, baseY: .25, tilt: .32, pickables,
        sync() { if (last !== S.step) { last = S.step; lab.set(`ขั้นตอนที่ ${S.step + 1}: ${STEPS[S.step][0]}`) } },
        update(t, dt) { segs.forEach((s, i) => { const on = i === S.step; const k = Math.min(1, dt * 6); s.position.y = lerp(s.position.y, on ? .14 : 0, k); s.position.x = lerp(s.position.x, on ? s.userData.dir.x * .1 : 0, k); s.position.z = lerp(s.position.z, on ? s.userData.dir.z * .1 : 0, k); const want = on ? s.userData.tS : s.userData.tN; if (s.userData.cMat.map !== want) { s.userData.cMat.map = want; s.userData.cMat.needsUpdate = true } s.userData.cMat.emissive.setScalar(on ? .08 + .05 * Math.sin(t * 4) : 0) }); g.rotation.y = Math.sin(t * .3) * .06 }
      };
      self.sync(); return self;
    },

    /* 11 — family: daughter encourages grandmother; tone changes her expression */
    family() {
      const g = new T.Group();
      const grandma = person({ shirt: 0xE9A6B8, pants: 0x5A4A6A, hair: 'bun', scale: .95, stoop: .1 }); grandma.group.position.set(.1, 0, 0); grandma.group.rotation.y = -.25; g.add(grandma.group);
      const daughter = person({ shirt: 0x5FA8D8, pants: 0x34445F, hair: 'long', hairColor: 0x2B2220, glasses: false, skin: 0xE9BC96 }); daughter.group.position.set(-.62, 0, .05); daughter.group.rotation.y = .45; g.add(daughter.group);
      const kid = person({ shirt: 0xF2B544, pants: 0x3E6FC7, hair: 'kid', hairColor: 0x2B2220, glasses: false, scale: .62, skin: 0xEAC09A }); kid.group.position.set(.75, 0, .25); kid.group.rotation.y = -.5; g.add(kid.group);
      const cane = taperTube([[.32, .02, .2], [.33, .5, .18], [.34, .82, .15]], .018, .018, phys(0x7A5A3E)); g.add(cane);
      const hook = tube([[.34, .82, .15], [.36, .9, .14], [.42, .9, .14]], .02, phys(0x7A5A3E)); g.add(hook);
      daughter.rS.rotation.set(-.4, 0, .5); daughter.rE.rotation.x = -.6; grandma.lS.rotation.set(-.2, 0, -.3); grandma.rS.rotation.set(-.35, 0, .2); grandma.rE.rotation.x = -.5;
      kid.lS.rotation.z = -.9; kid.lE.rotation.x = -.3;
      // speech bubble
      const bubble = new T.Group(); bubble.position.set(-.18, 2.12, .15); g.add(bubble);
      const BW = 1.5, BH = .6; const bs = new T.Shape(); const r = .18; bs.moveTo(-BW / 2 + r, -BH / 2); bs.lineTo(-.1, -BH / 2); bs.lineTo(-.22, -BH / 2 - .2); bs.lineTo(-.28, -BH / 2); bs.lineTo(BW / 2 - r, -BH / 2); bs.quadraticCurveTo(BW / 2, -BH / 2, BW / 2, -BH / 2 + r); bs.lineTo(BW / 2, BH / 2 - r); bs.quadraticCurveTo(BW / 2, BH / 2, BW / 2 - r, BH / 2); bs.lineTo(-BW / 2 + r, BH / 2); bs.quadraticCurveTo(-BW / 2, BH / 2, -BW / 2, BH / 2 - r); bs.lineTo(-BW / 2, -BH / 2 + r); bs.quadraticCurveTo(-BW / 2, -BH / 2, -BW / 2 + r, -BH / 2);
      const bubM = phys(0xFFFFFF, { roughness: .3, clearcoat: .6 }); const bub = M(new T.ExtrudeGeometry(bs, { depth: .05, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 3 }), bubM); bubble.add(bub);
      const BC = canvas(1024, 400); const bt = ctex(BC); const bface = M(new T.PlaneGeometry(BW * .92, BH * .9), new T.MeshBasicMaterial({ map: bt, transparent: true, toneMapped: false })); bface.position.z = .075; bubble.add(bface);
      function drawBubble(bad) { const c = BC.getContext('2d'); c.clearRect(0, 0, 1024, 400); c.fillStyle = bad ? '#A9501A' : '#1D7262'; c.font = `600 70px ${BODY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const lines = bad ? ['“บอกแล้วว่าห้ามกินขนม', 'ทำไมไม่เชื่อ!”'] : ['“วันนี้แม่เดินได้ตั้ง 20 นาที', 'พรุ่งนี้หนูเดินด้วยนะ”']; lines.forEach((l, i) => c.fillText(l, 512, 130 + i * 120)); bt.needsUpdate = true }
      const hs = new T.Shape(); hs.moveTo(0, -.35); hs.bezierCurveTo(-.05, -.25, -.42, -.05, -.42, .15); hs.bezierCurveTo(-.42, .38, -.12, .42, 0, .22); hs.bezierCurveTo(.12, .42, .42, .38, .42, .15); hs.bezierCurveTo(.42, -.05, .05, -.25, 0, -.35);
      const hg = new T.ExtrudeGeometry(hs, { depth: .14, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 4, curveSegments: 24 }); hg.center();
      const hm = phys(0xE0414E, { roughness: .2, clearcoat: 1 }); const heart = M(hg, hm); heart.scale.setScalar(.6); heart.position.set(.95, 1.62, 0); g.add(heart);
      const cloud = new T.Group();[[0, 0, .16], [.16, .03, .13], [-.16, .02, .12], [.06, .12, .12]].forEach(([x, y, r]) => { const s = M(new T.SphereGeometry(r, 20, 14), phys(0x8A949A, { roughness: .6 })); s.position.set(x, y, 0); cloud.add(s) }); cloud.position.set(.95, 1.62, 0); g.add(cloud);
      let last = '', kk = 0;
      const self = {
        group: g, spin: false, baseY: .1,
        sync() { const v = S.talk; if (v !== last) { last = v; drawBubble(v === 'bad'); grandma.mood(v === 'bad' ? 'sad' : 'happy'); daughter.mood(v === 'bad' ? 'flat' : 'happy') } },
        update(t, dt) {
          kk = lerp(kk, S.talk === 'bad' ? 1 : 0, Math.min(1, dt * 3));
          const beat = 1 + (1 - kk) * .08 * Math.max(0, Math.sin(t * 6)); heart.scale.setScalar(.6 * (1 - kk) * beat + .001); heart.rotation.y = t * .8; cloud.scale.setScalar(kk * .9 + .001); cloud.position.x = .95 + Math.sin(t) * .05;
          grandma.head.rotation.x = .25 * kk; grandma.spine.rotation.x = .1 + .12 * kk; kid.group.position.y = Math.abs(Math.sin(t * 3)) * .05 * (1 - kk);
          bubble.rotation.y = Math.sin(t * .6) * .08; [grandma, daughter, kid].forEach(p => p.tick(t, dt));
        }
      };
      self.sync(); return self;
    }
  };
  function surfaceMat(name, o) { const s = tex(name, () => surface(o)); return new T.MeshPhysicalMaterial({ color: 0xFFFFFF, map: s.map, normalMap: s.normalMap, roughness: .55, clearcoat: .2 }) }

  // every model stands on the same ceramic stage
  const OUT = {};
  // the stage is sized to what stands on it, so narrow subjects are not dwarfed by a wide platter
  function footprint(g) { g.updateMatrixWorld(true); const inv = new T.Matrix4().copy(g.matrixWorld).invert(), m = new T.Matrix4(), v = new T.Vector3(); let r = 0;
    g.traverse(o => { if (!o.isMesh || !o.visible || (o.material && o.material.visible === false) || o.isInstancedMesh) return; let vis = true; o.traverseAncestors(a => { if (a !== g.parent && a.scale && a.scale.x < .01) vis = false }); if (!vis) return;
      m.multiplyMatrices(inv, o.matrixWorld); const pa = o.geometry.attributes.position, st = Math.max(1, Math.floor(pa.count / 300));
      for (let i = 0; i < pa.count; i += st) { v.fromBufferAttribute(pa, i).applyMatrix4(m); if (v.y < 1.6) r = Math.max(r, Math.hypot(v.x, v.z * .8)) } });
    return r }
  for (const name in MODELS) OUT[name] = () => { const m = MODELS[name](); if (m.update) m.update(.5, .016); const r = footprint(m.group); const st = plinth(); const k = Math.min(1, Math.max(.62, (r + .14) / 1.38)); st.scale.set(k, 1, k); m.group.add(st); st.position.y = -.115; m.baseY = .115; m.noBob = true; return m };
  return OUT;
}
