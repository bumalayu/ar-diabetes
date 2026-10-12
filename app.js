// AR เบาหวานและไต — WebAR (MindAR + three.js)
// โครงสร้าง: data.js = เนื้อหาและบทบรรยาย, audio/ = ไฟล์เสียง, targets.mind = ภาพ Marker ที่คอมไพล์แล้ว
import * as THREE from 'three';
import { MindARThree } from './lib/mindar/mindar-image-three.prod.js';
import { DATA } from './data.js';
import { createModels } from './models.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ================= ตั้งค่า ================= */
const CONFIG = {
  // ลำดับต้องตรงกับลำดับภาพตอนคอมไพล์ targets.mind (markers/m1.png, m2.png, m3.png)
  targets: ['t1', 't2', 't3'],
  covers: ['markers/m1.png', 'markers/m2.png', 'markers/m3.png'],
  // ถ้าวางไฟล์วิดีโอจริงไว้ที่นี่ ปุ่ม "ดูวิดีโอ" จะเล่นวิดีโอนี้แทนหุ่น 3 มิติ
  exerciseVideo: 'media/exercise.mp4',
  // ขนาดภาพ 3 มิติเมื่อเทียบกับความกว้างของภาพ Marker (1 = กว้างเท่าภาพ)
  arScale: 0.3,
  // เวลารอ (มิลลิวินาที) ก่อนให้ภาพลอยค้างหน้าจอเมื่อกล้องหลุดจากภาพ
  lostDelay: 700
};

const $ = id => document.getElementById(id);
const T = THREE;
const N = DATA.N, CARE = DATA.CARE, ROUTINE = DATA.ROUTINE, STEPS = DATA.STEPS, STAGES = DATA.STAGES, STAGE_D = DATA.STAGE_D;
const S = { k: 0, gfr: 62, care: 0, rt: 0, step: 0, talk: 'good' };
const STEPW = ['ตั้งเป้า', 'เฝ้าดู', 'รู้แก้', 'วางแผน', 'ประเมิน', 'ปรับใหม่'];
const STAGE_C = ['#2E8B57', '#7DB646', '#D9B92E', '#E8913A', '#D2552F', '#9E2A2A'];
function stageIdx(v) { return v >= 90 ? 0 : v >= 60 ? 1 : v >= 45 ? 2 : v >= 30 ? 3 : v >= 15 ? 4 : 5 }
const screen = $('screen');
let cur = null, tabI = 0, done = new Set(), model = null;

/* ================= sheet content ================= */
function sentsOf(key){return N[key].flatMap(s=>s.sent)}
function genericHTML(key){
  const groups=[];
  for(const s of sentsOf(key)){ if(!s.hl||s.hl==='vid') continue; const g=groups[groups.length-1]; if(g&&g.k===s.hl) g.t.push(s.t); else groups.push({k:s.hl,t:[s.t]}); }
  let html='',inList=false;
  for(const g of groups){
    const isLi=/^[fem]\d$/.test(g.k)&&!['e3','m3'].includes(g.k);
    if(isLi&&!inList){html+='<ul>';inList=true}
    if(!isLi&&inList){html+='</ul>';inList=false}
    const txt=g.t.join(' ');
    if(isLi) html+=`<li data-hl="${g.k}">${txt}</li>`;
    else if(g.k==='h') html+=`<h4 data-hl="h">${txt}</h4>`;
    else if(g.k==='motto') html+=`<div class="motto" data-hl="motto">${g.t.join('<br>')}</div>`;
    else if(['e3','m3'].includes(g.k)) html+=`<div class="alert" data-hl="${g.k}">${txt}</div>`;
    else html+=`<p data-hl="${g.k}">${txt}</p>`;
  }
  if(inList) html+='</ul>';
  return html;
}
const chips=a=>`<div class="chips">${a.map(x=>`<span class="chip">${x}</span>`).join('')}</div>`;
const TOPICS={
 t1:{page:'เรื่องที่ 1',short:'เบาหวานชนิดที่ 2',title:'โรคเบาหวานชนิดที่ 2',see:'หยดเลือดกับก้อนน้ำตาล 3 มิติ จานอาหาร วิดีโอท่าออกกำลังกาย นาฬิกากินยา และลูกบอลฝึกหายใจ พร้อมเสียงบรรยาย',seed:11,
  tabs:[
   {label:'รู้จักโรค',model:'drop',html:()=>`<p class="lead" data-hl="p1">โรคเบาหวาน คือ ภาวะที่มีน้ำตาลในเลือดสูงกว่าปกติ เพราะร่างกายนำน้ำตาลไปใช้ได้ไม่ดี</p>
     <p data-hl="p2">หากควบคุมน้ำตาลได้ไม่ดีเป็นเวลานาน อาจส่งผลต่อ ตา ไต หัวใจ หลอดเลือด และเส้นประสาท</p>
     <div data-hl="sym"><h4>อาการที่พบบ่อย</h4>${chips(['หิวน้ำบ่อย','ปัสสาวะบ่อย','เหนื่อยง่าย','น้ำหนักลด','แผลหายช้า','ตาพร่ามัว','ติดเชื้อบ่อย'])}</div>
     <p class="small" data-hl="p3" style="margin-top:10px">หากมีอาการผิดปกติ ควรปรึกษาแพทย์หรือบุคลากรสุขภาพ</p>`},
   {label:'กินพอดี',model:'plate',html:()=>genericHTML('t1_1')},
   {label:'ขยับร่างกาย',model:'exercise',html:()=>`<button type="button" class="vidcard" data-hl="vid" id="openVid"><span class="pl"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z"/></svg></span><span><b>ดูวิดีโอ: ท่าออกกำลังกายสำหรับผู้สูงอายุ</b><small>7 ท่า ทำตามได้ทันที มีเสียงอธิบายและนับจังหวะ</small></span></button>`+genericHTML('t1_2')},
   {label:'กินยาตามสั่ง',model:'meds',html:()=>genericHTML('t1_3')},
   {label:'ดูแลใจ',model:'mind',html:()=>genericHTML('t1_4')}
  ]},
 t2:{page:'เรื่องที่ 2',short:'ไตจากเบาหวาน',title:'โรคแทรกซ้อนทางไตจากเบาหวาน',see:'ไต 3 มิติ เทียบไตปกติกับไตเสื่อม ค่า eGFR และ 10 วิธีฟื้นฟูไต พร้อมเสียงบรรยาย',seed:29,
  tabs:[
   {label:'ไตเสื่อมจากอะไร',model:'kidney',html:()=>`<div class="seg ${S.k?'bad':''}"><button type="button" data-k="0" aria-pressed="${!S.k}">ไตปกติ</button><button type="button" data-k="1" aria-pressed="${!!S.k}">ไตจากเบาหวาน</button></div>
     <div data-hl="k">${S.k?`<p class="lead">น้ำตาลในเลือดที่สูงเป็นเวลานาน ทำให้หลอดเลือดเล็ก ๆ ในไตเสียหาย</p><p>ไตกรองของเสียได้ลดลง และอาจพบ<b>โปรตีนรั่วออกมาในปัสสาวะ</b> (เม็ดสีเหลืองที่ไหลออก) หากไม่ได้รับการดูแล ไตจะค่อย ๆ เสื่อมจนถึงระยะไตวายได้</p>`
        :`<p class="lead">ไตปกติทำหน้าที่กรองของเสียออกจากเลือด และเก็บโปรตีนที่ร่างกายต้องใช้ไว้</p><p class="small">แตะ “ไตจากเบาหวาน” เพื่อดูว่าน้ำตาลสูงทำให้ไตเปลี่ยนไปอย่างไร</p>`}</div>
     <div data-hl="risk"><h4>สิ่งที่ทำให้ไตเสื่อมเร็วขึ้น</h4>${chips(['เป็นเบาหวานมานาน','คุมน้ำตาลไม่ดี','ความดันสูง','ไขมันในเลือดสูง','สูบบุหรี่','น้ำหนักเกิน','กินเค็ม','ใช้ยาแก้ปวด/สมุนไพรไม่เหมาะสม'])}</div>
     <p class="small" data-hl="old" style="margin-top:10px">โดยเฉพาะผู้สูงอายุ ที่การทำงานของไตลดลงตามวัย</p>`},
   {label:'ค่า eGFR',model:'egfr',html:()=>{const i=stageIdx(S.gfr);const st=STAGES[i];return `<p data-hl="intro">ค่า <b>eGFR</b> บอกว่าไตกรองของเสียได้ดีแค่ไหน ยิ่งตัวเลขต่ำ ไตยิ่งทำงานน้อยลง</p>
     <div class="gfr" data-hl="slider"><label for="gfr" class="small">เลื่อนเพื่อเปลี่ยนค่า eGFR</label><input id="gfr" type="range" min="5" max="120" value="${S.gfr}"></div>
     <div class="bands"><span></span><span></span><span></span><span></span><span></span><span></span></div>
     <div class="blabel"><span>G1</span><span>G2</span><span>G3a</span><span>G3b</span><span>G4</span><span>G5</span></div>
     <div class="gfr-out" data-hl="out"><div class="row"><span class="n" id="gfrN">${S.gfr}</span><span class="st" id="gfrS" style="color:${STAGE_C[i]}">ระยะ ${st[3]} · ${st[5]}</span></div><p id="gfrD" style="margin:4px 0 0">${STAGE_D[i]}</p></div>
     <p class="small" data-hl="note">ค่า eGFR ใช้ร่วมกับผลตรวจอื่น ควรให้แพทย์แปลผลทุกครั้ง</p>`}},
   {label:'10 วิธีดูแลไต',model:'care',html:()=>`<p data-hl="intro">การฟื้นฟูสมรรถนะทางไตของผู้สูงอายุโรคเบาหวาน แตะตัวเลขหรือลูกบอลรอบไตเพื่อฟังทีละข้อ</p>
     <div class="grid-btn g5">${CARE.map((c,i)=>`<button type="button" data-c="${i}" aria-pressed="${i===S.care}" aria-label="${c[0]}">${i+1}</button>`).join('')}</div>
     <div class="detail" data-hl="detail"><b>${S.care+1}. ${CARE[S.care][0]}</b>${CARE[S.care][1]}</div>
     <div class="motto" data-hl="motto">จำง่าย ๆ คุมน้ำตาล คุมความดัน ลดเค็ม ไม่ซื้อยากินเอง ออกกำลังกาย และตรวจไตตามนัด<br><span class="small">ทำอย่างสม่ำเสมอ ช่วยชะลอไตเสื่อม และช่วยให้มีคุณภาพชีวิตที่ดีขึ้น</span></div>`}
  ]},
 t3:{page:'เรื่องที่ 3',short:'จัดการตนเองและครอบครัว',title:'การจัดการตนเองและครอบครัวเพื่อฟื้นฟูไต',see:'แผ่นเช็กลิสต์ 3 มิติ วงล้อ 6 ขั้นตอน และครอบครัวตัวอย่าง พร้อมเสียงบรรยาย',seed:47,
  tabs:[
   {label:'สิ่งที่ทำประจำ',model:'routine',html:()=>`<p data-hl="intro">ผู้สูงอายุที่เป็นเบาหวาน หากมีระดับน้ำตาลในเลือดสูงเป็นเวลานาน อาจทำให้ไตทำงานลดลง การดูแลตนเองอย่างสม่ำเสมอร่วมกับความช่วยเหลือจากครอบครัว จะช่วยควบคุมโรค ชะลอการเสื่อมของไต และช่วยให้มีสุขภาพและคุณภาพชีวิตที่ดีขึ้น</p>
     <h4 data-hl="h">สิ่งที่ควรทำเป็นประจำ 6 ข้อ</h4>
     <div class="grid-btn g2">${ROUTINE.map((r,i)=>`<button type="button" data-r="${i}" aria-pressed="${i===S.rt}">${i+1}. ${r[0].replace(/^การ/,'')}</button>`).join('')}</div>
     <div class="detail" data-hl="detail"><b>${S.rt+1}. ${ROUTINE[S.rt][0]}</b>${ROUTINE[S.rt][1].join(' ')}</div>`},
   {label:'6 ขั้นตอน',model:'wheel',html:()=>`<div class="grid-btn g3">${STEPW.map((s,i)=>`<button type="button" data-s="${i}" aria-pressed="${i===S.step}">${i+1}. ${s}</button>`).join('')}</div>
     <div class="detail" data-hl="detail"><b>ขั้นตอนที่ ${S.step+1}: ${STEPS[S.step][0]}</b>${STEPS[S.step][1]}</div>
     <h4>ตัวอย่างในครอบครัวของยายมาลี</h4><p data-hl="ex">${STEPS[S.step][2]}</p>
     <div class="motto" data-hl="motto">6 ทำ จำง่าย ไตอยู่กับเรานาน<br>ตั้งเป้า • เฝ้าดู • รู้แก้ • วางแผน • ประเมิน • ปรับใหม่</div>`},
   {label:'ครอบครัวช่วยได้',model:'family',html:()=>`<div data-hl="roles"><p>ครอบครัวมีส่วนสำคัญในการช่วยดูแลผู้สูงอายุ</p>${chips(['เตรียมอาหารที่เหมาะสม','เตือนกินยาตามแพทย์สั่ง','ชวนออกกำลังกาย','พาไปตรวจตามนัด','ช่วยสังเกตอาการผิดปกติ','ให้กำลังใจ ไม่ตำหนิหรือบังคับ'])}</div>
     <h4>พูดอย่างไรดี</h4>
     <div class="seg ${S.talk==='bad'?'bad':''}"><button type="button" data-t="bad" aria-pressed="${S.talk==='bad'}">แบบตำหนิ</button><button type="button" data-t="good" aria-pressed="${S.talk==='good'}">แบบให้กำลังใจ</button></div>
     <div data-hl="talk">${S.talk==='bad'?`<p class="say neg">“บอกแล้วว่าห้ามกินขนม ทำไมไม่เชื่อ”</p><p class="small">คำตำหนิทำให้ผู้สูงอายุรู้สึกผิด และอาจไม่อยากเล่าเมื่อมีปัญหา</p>`
       :`<p class="say">“วันนี้แม่เดินได้ตั้ง 20 นาที พรุ่งนี้หนูเดินด้วยนะ”</p><p class="small">ชมสิ่งที่ทำได้ และชวนทำด้วยกัน ช่วยให้ผู้สูงอายุอยากดูแลตนเองต่อเนื่อง</p>`}</div>
     <p data-hl="close" style="margin-top:10px">เมื่อผู้สูงอายุและครอบครัวร่วมกันดูแลอย่างต่อเนื่อง จะช่วยให้ควบคุมโรคเบาหวานได้ดีขึ้น คงการทำงานของไตให้นานที่สุด ชะลอไตเสื่อม ลดภาวะแทรกซ้อน และใช้ชีวิตประจำวันได้อย่างมีความสุข</p>`}
  ]}
};


/* ================= audio ================= */
let ctx=null,master=null,sfxGain=null,narrGain=null;
function ensureAudio(){
  try{
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;ctx=new AC();
      master=ctx.createGain();master.connect(ctx.destination);
      narrGain=ctx.createGain();narrGain.gain.value=1;narrGain.connect(master);
      sfxGain=ctx.createGain();sfxGain.gain.value=.22;sfxGain.connect(master);}
    if(ctx.state==='suspended')ctx.resume();
  }catch(e){}
}
function tone(f,t0,dur,type='sine',vol=1,f2){
  if(!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t0);
  if(f2)o.frequency.exponentialRampToValueAtTime(f2,t0+dur);
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.012);g.gain.exponentialRampToValueAtTime(.0008,t0+dur);
  o.connect(g);g.connect(sfxGain);o.start(t0);o.stop(t0+dur+.05);
}
const sfx={
  start(){if(!ctx)return;const t=ctx.currentTime;tone(320,t,.5,'sine',.5,880)},
  tick(p){if(!ctx)return;tone(900+p*7,ctx.currentTime,.05,'square',.18)},
  found(){if(!ctx)return;const t=ctx.currentTime;[523.25,659.25,783.99,1046.5].forEach((f,i)=>{tone(f,t+i*.085,.55,'triangle',.6);tone(f*2,t+i*.085,.3,'sine',.15)})},
  pop(){if(!ctx)return;tone(660,ctx.currentTime,.14,'sine',.45,990)},
  select(){if(!ctx)return;tone(740,ctx.currentTime,.09,'triangle',.4)}
};
const bufCache={};
function getBuf(key){
  if(bufCache[key])return bufCache[key];
  if(!ctx||!key)return Promise.reject('no audio');
  const p=fetch((parseInt(key[0],16)<8?'audio1/':'audio2/')+key+'.mp3').then(r=>{if(!r.ok)throw new Error('missing audio '+key);return r.arrayBuffer()}).then(b=>new Promise((res,rej)=>ctx.decodeAudioData(b,res,rej)));
  bufCache[key]=p;p.catch(()=>{delete bufCache[key]});
  return p;
}

/* ================= narration player ================= */
const P={id:0,state:'idle',key:null,seg:0,sent:0,only:false,src:null,timer:null,muted:false};
let thVoice=null,devBroken=false;
function voiceMode(){const v=document.querySelector('input[name="voice"]:checked').value;if(v==='rec')return 'rec';return (thVoice&&!devBroken)?'dev':'rec'}
function findThai(){try{const vs=speechSynthesis.getVoices().filter(v=>/^th/i.test(v.lang)&&!/niwat|pattara|male/i.test(v.name));
  const pref=[/premwadee/i,/kanya/i,/narisa/i,/achara/i,/google/i];thVoice=null;for(const r of pref){thVoice=vs.find(v=>r.test(v.name));if(thVoice)break}if(!thVoice)thVoice=vs[0]||null}catch(e){thVoice=null}
  const el=$('voiceNow');if(el)el.textContent=thVoice?`เสียงของเครื่องที่พบ: ${thVoice.name}`:'เครื่องนี้ไม่มีเสียงผู้หญิงภาษาไทย จะใช้เสียงที่บันทึกไว้'}
function speakText(se){return (se.v||se.t).replace(/eGFR/g,'อีจีเอฟอาร์').replace(/NSAIDs/g,'เอ็นเสด')}
function devSpeak(se,done,fail,rate){
  let started=false,ended=false;
  try{const u=new SpeechSynthesisUtterance(speakText(se));u.lang='th-TH';u.voice=thVoice;u.rate=rate||.95;u.pitch=1.08;
    u.onstart=()=>{started=true};u.onend=()=>{if(!ended){ended=true;done()}};u.onerror=()=>{if(ended)return;ended=true;started?done():fail()};
    speechSynthesis.speak(u);
    setTimeout(()=>{if(!started&&!ended){ended=true;try{speechSynthesis.cancel()}catch(e){}devBroken=true;fail()}},2500);
  }catch(e){fail()}
}
if('speechSynthesis' in window){findThai();try{speechSynthesis.onvoiceschanged=findThai}catch(e){}}
function stopAudioOnly(){
  clearTimeout(P.timer);
  if(P.src){try{P.src.onended=null;P.src.stop()}catch(e){}P.src=null}
  try{if('speechSynthesis' in window)speechSynthesis.cancel()}catch(e){}
}
function stopNarr(){P.id++;stopAudioOnly();P.state='idle';setPP();clearReading();setCaption('')}
function setCaption(t){$('capTxt').textContent=t}
function clearReading(){document.querySelectorAll('.reading').forEach(e=>e.classList.remove('reading'))}
function highlight(k){
  clearReading();if(!k)return;const body=$('shBody');
  const el=body.querySelector(`[data-hl="${k}"]`);if(!el)return;el.classList.add('reading');
  const top=el.offsetTop-12, bottom=el.offsetTop+el.offsetHeight-body.clientHeight+16;
  if(el.offsetTop<body.scrollTop+8)body.scrollTo({top,behavior:'smooth'});
  else if(el.offsetTop+el.offsetHeight>body.scrollTop+body.clientHeight-8)body.scrollTo({top:Math.min(top,Math.max(bottom,top)),behavior:'smooth'});
}
function trackLen(key){return N[key].reduce((a,s)=>a+s.sent.length,0)}
function progIndex(key,seg,sent){let n=0;for(let i=0;i<seg;i++)n+=N[key][i].sent.length;return n+sent}
function playTrack(key,seg=0,only=false){
  stopAudioOnly();const id=++P.id;
  Object.assign(P,{key,seg,sent:0,only,state:'playing'});
  const sg0=N[key]&&N[key][seg];if(sg0&&sg0.set)applySet(sg0.set);
  setPP();
  if(P.muted){P.state='idle';setPP();if(sg0){const se=sg0.sent[only&&sg0.sent.length>1&&!sg0.sent[0].hl?1:0];if(se)highlight(se.hl)}return}
  step(id,true);
}
function step(id,fresh){
  if(id!==P.id)return;
  const segs=N[P.key];const sg=segs[P.seg];
  if(!sg){return trackEnd(id)}
  if(P.sent===0&&sg.set&&!fresh)applySet(sg.set);
  const se=sg.sent[P.sent];
  if(!se){ if(P.only){return finish(id)} P.seg++;P.sent=0;return step(id)}
  setCaption(se.v||se.t);highlight(se.hl);if(model&&model.fx)model.fx(se.fx||null);
  $('prog').style.width=(100*(progIndex(P.key,P.seg,P.sent)+1)/trackLen(P.key))+'%';
  const next=()=>{if(id!==P.id)return;P.sent++;P.timer=setTimeout(()=>step(id),420)};
  const rec=()=>getBuf(se.a).then(buf=>{
    if(id!==P.id)return;
    const src=ctx.createBufferSource();src.buffer=buf;src.connect(narrGain);src.onended=()=>{if(P.src===src)P.src=null;next()};P.src=src;src.start();
    const k2=nextKey();if(k2)getBuf(k2).catch(()=>{});
  }).catch(()=>{P.timer=setTimeout(next,Math.max(1800,se.t.length*90))});
  if(voiceMode()==='dev'){devSpeak(se,next,()=>{if(id===P.id)rec()});return}
  rec();
}
function nextKey(){const sg=N[P.key][P.seg];if(!sg)return null;const s=sg.sent[P.sent+1]||(N[P.key][P.seg+1]&&N[P.key][P.seg+1].sent[0]);return s?s.a:null}
function finish(id){if(id!==P.id)return;P.state='idle';setPP();clearReading();setTimeout(()=>{if(id===P.id)setCaption('')},1200)}
function trackEnd(id){
  if(id!==P.id)return;
  const tabs=TOPICS[cur].tabs;markDone(tabI);
  if($('autoNext').checked&&tabI<tabs.length-1){
    P.timer=setTimeout(()=>{if(id!==P.id)return;goTab(tabI+1,true)},900);
    P.state='playing';return;
  }
  finish(id);
  if(tabI===tabs.length-1){setCaption('จบเรื่องนี้แล้ว แตะหัวข้อใดก็ได้เพื่อฟังซ้ำ');showEnd()}
}
function setPP(){
  const playing=P.state==='playing';
  $('ppIco').innerHTML=playing?'<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>':'<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>';
  $('pp').setAttribute('aria-label',playing?'หยุดชั่วคราว':(P.state==='paused'?'เล่นต่อ':'เล่นเสียงบรรยาย'));
}
$('pp').addEventListener('click',()=>{
  ensureAudio();
  if(P.state==='playing'){
    P.state='paused';setPP();
    try{speechSynthesis.pause()}catch(e){}if(ctx)ctx.suspend();
    clearTimeout(P.timer);P.pausedTimer=true;return;
  }
  if(P.state==='paused'){
    P.state='playing';setPP();
    try{speechSynthesis.resume()}catch(e){}if(ctx)ctx.resume();
    if(!P.src&&!(voiceMode()==='dev'&&speechSynthesis.speaking)){const id=P.id;P.timer=setTimeout(()=>step(id),200)}
    return;
  }
  if(P.muted)toggleMute();
  playTrack(`${cur}_${tabI}`);
});
$('replay').addEventListener('click',()=>{ensureAudio();if(ctx&&ctx.state==='suspended')ctx.resume();if(P.muted)toggleMute();playTrack(`${cur}_${tabI}`)});
function toggleMute(){
  P.muted=!P.muted;$('mute').setAttribute('aria-pressed',P.muted);$('mute').classList.toggle('off',P.muted);
  $('muteTxt').textContent=P.muted?'เสียงปิด':'เสียงเปิด';
  $('muteIco').innerHTML=P.muted?'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M22 9l-6 6M16 9l6 6"/>':'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>';
  if(P.muted)stopNarr();
}
$('mute').addEventListener('click',()=>{ensureAudio();toggleMute()});
document.querySelectorAll('input[name="voice"]').forEach(r=>r.addEventListener('change',()=>{
  findThai();devBroken=false;
  if(r.value==='dev'&&r.checked&&(!('speechSynthesis' in window)||!thVoice)){toast('เครื่องนี้ไม่มีเสียงผู้หญิงภาษาไทย จะใช้เสียงที่บันทึกไว้แทน');$('v-rec').checked=true;return}
  if(cur&&P.state!=='idle')playTrack(P.key,P.seg,P.only);
}));



/* ================= UI flow ================= */
const MODE = { ar: false };          // ar = ใช้กล้องอยู่
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200) }
function topicIds() { return Object.keys(TOPICS) }
function buildCovers() {
  $('covers').innerHTML = CONFIG.targets.map((id, i) => `<figure><img src="${CONFIG.covers[i]}" alt="" loading="eager"><figcaption>${TOPICS[id].page}<br>${TOPICS[id].short}</figcaption></figure>`).join('');
  $('thumbs').innerHTML = CONFIG.covers.map(src => `<img src="${src}" alt="">`).join('');
  $('pickList').innerHTML = CONFIG.targets.map((id, i) => `<button type="button" data-pick="${id}"><img src="${CONFIG.covers[i]}" alt=""><span><b>${TOPICS[id].title}</b><small>${TOPICS[id].see}</small></span></button>`).join('');
  $('pickList').querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { ensureAudio(); closePicker(); openTopic(b.dataset.pick, 'float') }));
}
function openPicker() { $('picker').hidden = false }
function closePicker() { $('picker').hidden = true }

// แสดงหน้าค้นหา Marker (กล้องเปิดอยู่ ยังไม่เจอภาพ)
function showScanning(msg) {
  if (VID.on) closeVideo(); stopNarr(); cur = null; G.clear();
  screen.classList.remove('found', 'just', 'open'); $('topbar').hidden = true; $('floatChip').hidden = true;
  $('idle').hidden = !MODE.ar; $('idleMsg').innerHTML = msg || 'ส่องภาพปกในคู่มือ<br>ให้เห็นทั้งภาพ';
  if (!MODE.ar) openPicker();
}
function scan(id) {                     // ใช้กับปุ่ม "ไปเรื่องถัดไป"
  if (MODE.ar) showScanning(`ส่องภาพปกของ<br>${TOPICS[id].title}`);
  else openTopic(id, 'float');
}

// เปิดเนื้อหาเรื่อง id; where = 'anchor' (วางบนภาพ) หรือ 'float' (ลอยหน้าจอ)
function openTopic(id, where) {
  ensureAudio(); if (VID.on) closeVideo(); stopNarr();
  cur = id; tabI = 0; done = new Set(); Object.assign(S, { k: 0, gfr: 62, care: 0, rt: 0, step: 0, talk: 'good' });
  $('idle').hidden = true; $('topbar').hidden = false;
  screen.classList.remove('open'); screen.classList.add('found', 'just');
  $('foundTag').textContent = (where === 'anchor' ? 'พบภาพแล้ว: ' : '') + TOPICS[id].title;
  $('shTitle').textContent = TOPICS[id].title;
  sfx.found(); try { navigator.vibrate && navigator.vibrate([40, 40, 80]) } catch (e) { }
  renderTabs(); renderBody();
  G.show(id, where); G.setModel(TOPICS[id].tabs[0].model, true); G.burst();
  setTimeout(() => screen.classList.remove('just'), 2500);
  showHint();
  const pid = P.id; setTimeout(() => { if (cur === id && P.id === pid) playTrack(`${id}_0`) }, 1300);
}
function showHint() { const h = $('hint'); h.classList.add('show'); clearTimeout(showHint._t); showHint._t = setTimeout(() => h.classList.remove('show'), 4500) }
$('back').addEventListener('click', () => { if (MODE.ar) showScanning(); else { showScanning(); } });
$('grab').addEventListener('click', () => { screen.classList.toggle('open'); $('grabTxt').textContent = screen.classList.contains('open') ? 'แตะเพื่อย่อ' : 'แตะเพื่ออ่านเนื้อหา' });
function markDone(i) { done.add(i); const b = $('tabs').querySelector(`[data-tab="${i}"]`); if (b) b.classList.add('done') }
function renderTabs() {
  $('tabs').innerHTML = TOPICS[cur].tabs.map((x, i) => `<button class="tab ${done.has(i) ? 'done' : ''}" role="tab" type="button" data-tab="${i}" aria-selected="${i === tabI}">${x.label}</button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { ensureAudio(); goTab(+b.dataset.tab, true) }));
}
function goTab(i, narrate) {
  stopAudioOnly(); P.id++; tabI = i;
  const first = N[`${cur}_${i}`][0]; if (first && first.set) Object.assign(S, first.set);
  renderTabs(); renderBody(); $('shBody').scrollTop = 0;
  const b = $('tabs').querySelector(`[data-tab="${i}"]`); if (b) b.scrollIntoView({ inline: 'center', block: 'nearest' });
  G.setModel(TOPICS[cur].tabs[i].model); sfx.pop();
  if (narrate) playTrack(`${cur}_${i}`); else { P.state = 'idle'; setPP() }
}
function renderBody() {
  const keep = document.querySelector('.reading'); const k = keep && keep.dataset.hl;
  $('shBody').innerHTML = TOPICS[cur].tabs[tabI].html(); bindBody();
  if (k) { const el = $('shBody').querySelector(`[data-hl="${k}"]`); if (el) el.classList.add('reading') }
}
function applySet(set) { Object.assign(S, set); renderBody(); if (model && model.sync) model.sync() }
function showEnd() {
  const ids = topicIds(); const nx = ids[(ids.indexOf(cur) + 1) % ids.length];
  const d = document.createElement('div'); d.className = 'end';
  d.innerHTML = `<button type="button" id="again">ฟังเรื่องนี้ตั้งแต่ต้น</button><button type="button" id="nextT">ไปเรื่องถัดไป: ${TOPICS[nx].title}</button>`;
  $('shBody').appendChild(d);
  $('again').onclick = () => { done = new Set(); goTab(0, true) }; $('nextT').onclick = () => scan(nx);
  screen.classList.add('open'); $('grabTxt').textContent = 'แตะเพื่อย่อ';
  $('shBody').scrollTo({ top: $('shBody').scrollHeight, behavior: 'smooth' });
}
function pick(kind, i) { ensureAudio(); sfx.select(); playTrack(`${cur}_${tabI}`, i + 1, true) }
function bindBody() {
  const b = $('shBody');
  b.querySelectorAll('[data-k]').forEach(x => x.addEventListener('click', () => { ensureAudio(); sfx.select(); playTrack(`${cur}_${tabI}`, +x.dataset.k, true) }));
  b.querySelectorAll('[data-c]').forEach(x => x.addEventListener('click', () => pick('care', +x.dataset.c)));
  b.querySelectorAll('[data-r]').forEach(x => x.addEventListener('click', () => pick('rt', +x.dataset.r)));
  b.querySelectorAll('[data-s]').forEach(x => x.addEventListener('click', () => pick('step', +x.dataset.s)));
  b.querySelectorAll('[data-t]').forEach(x => x.addEventListener('click', () => { ensureAudio(); sfx.select(); playTrack(`${cur}_${tabI}`, x.dataset.t === 'bad' ? 1 : 2, true) }));
  const ov = $('openVid'); if (ov) ov.addEventListener('click', openExercise);
  const r = $('gfr');
  if (r) r.addEventListener('input', () => {
    if (P.state !== 'idle') stopNarr();
    S.gfr = +r.value; const i = stageIdx(S.gfr), st = STAGES[i]; $('gfrN').textContent = S.gfr; const s = $('gfrS'); s.textContent = `ระยะ ${st[3]} · ${st[5]}`; s.style.color = STAGE_C[i]; $('gfrD').textContent = STAGE_D[i];
    if (model && model.sync) model.sync();
  });
}

/* ---------- settings ---------- */
function openSettings() { findThai(); $('settings').hidden = false }
$('openSet1').addEventListener('click', openSettings);
$('openSet2').addEventListener('click', openSettings);
$('setClose').addEventListener('click', () => { $('settings').hidden = true; try { localStorage.setItem('ar-voice', document.querySelector('input[name="voice"]:checked').value); localStorage.setItem('ar-auto', $('autoNext').checked ? '1' : '0') } catch (e) { } });
try { const v = localStorage.getItem('ar-voice'); if (v && $('v-' + v)) $('v-' + v).checked = true; if (localStorage.getItem('ar-auto') === '0') $('autoNext').checked = false } catch (e) { }

/* ---------- start ---------- */
$('noCam').addEventListener('click', () => { ensureAudio(); $('start').hidden = true; MODE.ar = false; G.startPreview(); openPicker() });
$('idlePick').addEventListener('click', () => { G.stopCamera(); MODE.ar = false; $('idle').hidden = true; G.startPreview(); openPicker() });
$('pickClose').addEventListener('click', () => { closePicker(); if (!cur) { $('start').hidden = false } });
$('go').addEventListener('click', async () => {
  ensureAudio(); $('startErr').hidden = true; $('go').disabled = true; $('go').textContent = 'กำลังเปิดกล้อง…';
  try {
    await G.startCamera();
    MODE.ar = true; $('start').hidden = true; showScanning(); sfx.start();
  } catch (e) {
    console.error(e);
    const name = e && (e.name || e.message) || '';
    let msg = 'เปิดกล้องไม่ได้ ';
    if (/NotAllowed|Permission/i.test(name)) msg += 'เพราะยังไม่ได้อนุญาตให้ใช้กล้อง ให้แตะไอคอนกล้องหรือรูปกุญแจที่แถบที่อยู่ด้านบน แล้วเลือกอนุญาต จากนั้นกดเริ่มอีกครั้ง';
    else if (/NotFound|Overconstrained/i.test(name)) msg += 'เพราะไม่พบกล้องในเครื่องนี้';
    else if (!window.isSecureContext) msg += 'เพราะเว็บนี้ไม่ได้เปิดผ่าน https';
    else msg += 'ลองปิดแอปอื่นที่ใช้กล้องอยู่ แล้วกดเริ่มอีกครั้ง';
    msg += ' หรือกด "ดูได้เลยโดยไม่ต้องส่อง" ด้านล่าง';
    $('startErr').textContent = msg; $('startErr').hidden = false;
  } finally { $('go').disabled = false; $('go').textContent = 'เริ่มส่องกล้อง' }
});

/* ---------- real exercise video, if provided ---------- */
let hasRealVideo = null;
async function checkRealVideo() {
  if (hasRealVideo !== null) return hasRealVideo;
  try { const r = await fetch(CONFIG.exerciseVideo, { method: 'HEAD', cache: 'no-store' }); hasRealVideo = r.ok && !/text\/html/.test(r.headers.get('content-type') || '') } catch (e) { hasRealVideo = false }
  return hasRealVideo;
}
async function openExercise() {
  ensureAudio();
  if (await checkRealVideo()) {
    stopNarr(); const v = $('rv'); if (!v.src) v.src = CONFIG.exerciseVideo; $('realVid').hidden = false; try { await v.play() } catch (e) { }
  } else startVideo();
}
$('rvClose').addEventListener('click', () => { const v = $('rv'); try { v.pause() } catch (e) { } $('realVid').hidden = true });

/* ================= exercise video ================= */
const VCH=DATA.VID, COUNT_MS=2600;
const VID={on:false,playing:false,ch:0,mode:'intro',si:0,count:0,cStart:0,pausedAt:0,id:0,src:null,csrc:null,timer:null,ended:false,done:new Set()};
function vStopAudio(){clearTimeout(VID.timer);[VID.src,VID.csrc].forEach(s=>{if(s){try{s.onended=null;s.stop()}catch(e){}}});VID.src=VID.csrc=null;try{if('speechSynthesis' in window)speechSynthesis.cancel()}catch(e){}}
function vSay(se,cb){
  const id=VID.id;const done=()=>{if(id===VID.id)cb()};
  if(P.muted){VID.timer=setTimeout(done,Math.max(1400,se.t.length*85));return}
  const rec=()=>getBuf(se.a).then(buf=>{if(id!==VID.id)return;const src=ctx.createBufferSource();src.buffer=buf;src.connect(narrGain);src.onended=()=>{if(VID.src===src)VID.src=null;done()};VID.src=src;src.start()}).catch(()=>{VID.timer=setTimeout(done,1600)});
  if(voiceMode()==='dev'){devSpeak(se,done,()=>{if(id===VID.id)rec()});return}
  rec();
}
function vCountVoice(se){
  if(P.muted)return;
  if(voiceMode()==='dev'){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(se.s||se.t);u.lang='th-TH';u.voice=thVoice;u.rate=1;u.pitch=1.08;speechSynthesis.speak(u)}catch(e){}return}
  const id=VID.id;getBuf(se.a).then(buf=>{if(id!==VID.id)return;const src=ctx.createBufferSource();src.buffer=buf;src.connect(narrGain);VID.csrc=src;src.start()}).catch(()=>{});
}
function setVPlay(){$('vPlayIco').innerHTML=VID.playing?'<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>':'<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>';$('vPlay').setAttribute('aria-label',VID.playing?'หยุดชั่วคราว':'เล่น')}
function buildVProg(){$('vProg').innerHTML=VCH.map((c,i)=>`<button type="button" data-v="${i}" aria-label="${c.title}"><i></i></button>`).join('');$('vProg').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ensureAudio();vGo(+b.dataset.v)}))}
function updVProg(){$('vProg').querySelectorAll('button').forEach((b,i)=>{const C=VCH[i];let w=0;
  if(VID.done.has(i)&&i!==VID.ch)w=100;else if(i===VID.ch){w=VID.mode==='count'&&C.counts?Math.round(100*(.25+.75*VID.count/C.counts)):Math.round(25*VID.si/Math.max(1,C.sent.length))}
  b.querySelector('i').style.width=w+'%';b.classList.toggle('cur',i===VID.ch)})}
function updVUI(){const C=VCH[VID.ch];const n=VCH.length-2;$('vTitle').textContent=(VID.ch>0&&VID.ch<=n)?`ท่าที่ ${VID.ch}/${n} · ${C.title}`:C.title;updVProg()}
function startVideo(){ensureAudio();stopNarr();VID.on=true;VID.done=new Set();screen.classList.add('video');screen.classList.remove('min');$('vui').hidden=false;$('hint').classList.remove('show');buildVProg();vGo(0)}
function closeVideo(){VID.id++;vStopAudio();VID.on=false;VID.playing=false;screen.classList.remove('video');$('vui').hidden=true;$('vCount').hidden=true;setCaption('')}
function vGo(ch){VID.id++;vStopAudio();VID.ended=false;VID.ch=ch;VID.mode='intro';VID.si=0;VID.count=0;VID.playing=true;$('vCount').hidden=true;setVPlay();updVUI();sfx.pop();vStep()}
function vStep(){
  const id=VID.id;if(!VID.playing)return;const C=VCH[VID.ch];
  if(VID.mode==='intro'){
    const se=C.sent[VID.si];
    if(!se){if(C.counts){VID.mode='count';VID.count=0;return vStep()}return vNextCh()}
    setCaption(se.v||se.t);updVProg();
    vSay(se,()=>{VID.si++;VID.timer=setTimeout(()=>{if(id===VID.id)vStep()},450)});return;
  }
  if(VID.count>=C.counts)return vNextCh();
  VID.cStart=performance.now();$('vCount').hidden=false;$('vCountN').textContent=VID.count+1;$('vCountOf').textContent=C.counts;
  setCaption(`${C.title} · ครั้งที่ ${VID.count+1}`);updVProg();
  vCountVoice(DATA.COUNT[VID.count%8]);
  VID.timer=setTimeout(()=>{if(id!==VID.id)return;VID.count++;vStep()},COUNT_MS);
}
function vNextCh(){const id=VID.id;$('vCount').hidden=true;VID.done.add(VID.ch);updVProg();
  if(VID.ch<VCH.length-1){sfx.select();VID.timer=setTimeout(()=>{if(id===VID.id)vGo(VID.ch+1)},800)}
  else{VID.playing=false;VID.ended=true;setVPlay();setCaption('จบวิดีโอแล้ว กดปุ่มเล่นเพื่อดูอีกครั้ง หรือกดปิดเพื่อกลับ')}}
$('vPlay').addEventListener('click',()=>{ensureAudio();if(ctx&&ctx.state==='suspended')ctx.resume();
  if(VID.ended){VID.done=new Set();return vGo(0)}
  if(VID.playing){VID.playing=false;VID.pausedAt=performance.now();VID.id++;vStopAudio();setVPlay();setCaption('หยุดชั่วคราว')}
  else{VID.playing=true;setVPlay();vStep()}});
$('vPrev').addEventListener('click',()=>{ensureAudio();vGo(Math.max(0,VID.ch-1))});
$('vNext').addEventListener('click',()=>{ensureAudio();VID.done.add(VID.ch);vGo(Math.min(VCH.length-1,VID.ch+1))});
$('vClose').addEventListener('click',closeVideo);



/* ================= 3D + tracking ================= */
const G = (function () {
  const container = $('ar');
  const mindar = new MindARThree({
    container, imageTargetSrc: 'targets.mind', maxTrack: 1,
    uiLoading: 'no', uiScanning: 'no', uiError: 'no',
    filterMinCF: 0.0001, filterBeta: 0.001, warmupTolerance: 3, missTolerance: 8
  });
  const { renderer, scene } = mindar; const arCam = mindar.camera;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.NoToneMapping;
  const prevCam = new T.PerspectiveCamera(40, 1, 1, 100000);    // used when viewing without the camera
  scene.add(arCam); scene.add(prevCam);
  let camOn = false, previewOn = false;

  // soft studio environment for glossy, dimensional materials
  try {
    const pm = new T.PMREMGenerator(renderer); const env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(12, 12, 12), new T.MeshBasicMaterial({ color: new T.Color(.16, .145, .13), side: T.BackSide })));
    [[7, 3, 0, 5.9, 0, 1.9], [4, 5, -5.9, 1.2, 0, .9], [4, 4, 5.9, 2, 2.5, 1.2], [5, 2, 0, 1, 5.9, .7]].forEach(([w, h, x, y, z, i]) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(i, i * .98, i * .94), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m) });
    scene.environment = pm.fromScene(env, .035).texture;
  } catch (e) { }
  scene.add(new T.HemisphereLight(0xfff4e6, 0x5d4c3c, .5));
  const sun = new T.DirectionalLight(0xfff1de, 1.0); sun.position.set(.5, 1, .8); scene.add(sun);
  const rim = new T.DirectionalLight(0xcfeaff, .5); rim.position.set(-1, .4, -1); scene.add(rim);

  // anchors (one per printed cover) and a camera-locked holder for "floating" mode
  const anchors = CONFIG.targets.map((id, i) => mindar.addAnchor(i));
  const floatA = new T.Group(); arCam.add(floatA);
  const floatP = new T.Group(); prevCam.add(floatP);
  const holder = new T.Group(); holder.visible = false;          // everything we draw lives in here, in "old" Y-up units
  const MS = 1 / CONFIG.arScale;                                  // marker width expressed in content units
  const SCAN = 0x5BE3B5;

  // glowing pedestal + soft contact shadow under the floating object
  function radialTex(stops) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t }
  const blob = new T.Mesh(new T.CircleGeometry(1.0, 48), new T.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,.42)'], [.5, 'rgba(0,0,0,.14)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .004; holder.add(blob);
  const ped = new T.Mesh(new T.CircleGeometry(.95, 48), new T.MeshBasicMaterial({ map: radialTex([[0, 'rgba(91,227,181,.9)'], [.55, 'rgba(91,227,181,.25)'], [1, 'rgba(91,227,181,0)']]), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ped.rotation.x = -Math.PI / 2; ped.position.y = .012; holder.add(ped);
  const pedRing = new T.Mesh(new T.RingGeometry(.7, .74, 72), new T.MeshBasicMaterial({ color: SCAN, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pedRing.rotation.x = -Math.PI / 2; pedRing.position.y = .013; holder.add(pedRing);
  // found effects: ripples over the printed cover, a light column and rising sparks
  const waves = [0, 1].map(() => { const w = new T.Mesh(new T.RingGeometry(.92, 1, 72), new T.MeshBasicMaterial({ color: SCAN, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false })); w.rotation.x = -Math.PI / 2; w.position.y = .01; w.userData.s = MS / 2; holder.add(w); return w });
  const beam = new T.Mesh(new T.CylinderGeometry(.9, .9, 3.2, 48, 1, true), new T.MeshBasicMaterial({ color: SCAN, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false })); beam.position.y = 1.6; holder.add(beam);
  const PN = 140; const pg = new T.BufferGeometry(); const pp = new Float32Array(PN * 3), pv = new Float32Array(PN);
  pg.setAttribute('position', new T.BufferAttribute(pp, 3));
  const pts = new T.Points(pg, new T.PointsMaterial({ color: 0xE9FFF6, size: .06, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); holder.add(pts);
  let burstT = -1;
  const root = new T.Group(); holder.add(root); const pivot = new T.Group(); root.add(pivot);
  let rotY = 0, rotX = 0, vY = 0, vX = 0, zoom = 1, zoomS = 1, lastInteract = -10, popT = 1, outModel = null, outT = 0;
  const out = {};

  /* ---------- helpers ---------- */
  const std=(c,o={})=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:.5,metalness:0},o));
  const phys=(c,o={})=>new T.MeshPhysicalMaterial(Object.assign({color:c,roughness:.3,clearcoat:.6,clearcoatRoughness:.3},o));
  function M(g,m,shadow=true){const x=new T.Mesh(g,m);x.castShadow=shadow;x.receiveShadow=true;return x}
  const seg=(typeof Intl!=='undefined'&&Intl.Segmenter)?new Intl.Segmenter('th',{granularity:'word'}):null;
  function wrap(c,text,maxW){
    const parts=seg?[...seg.segment(text)].map(s=>s.segment):text.split('');const lines=[];let line='';
    for(const p of parts){const t=line+p;if(c.measureText(t).width>maxW&&line){lines.push(line.trim());line=p}else line=t}
    if(line.trim())lines.push(line.trim());return lines;
  }
  function label(text,o={}){
    const cv=document.createElement('canvas');const c=cv.getContext('2d');const tex=new T.CanvasTexture(cv);tex.minFilter=T.LinearFilter;tex.encoding=T.sRGBEncoding;
    const mat=new T.SpriteMaterial({map:tex,transparent:true,depthTest:false,toneMapped:false});const sp=new T.Sprite(mat);sp.renderOrder=20;
    sp.userData.h=(o.h||.24)*1.45;
    sp.set=(txt,oo={})=>{
      const opt=Object.assign({},o,oo);const fs=opt.fs||44,pad=opt.pad==null?22:opt.pad,maxW=opt.maxW||520,mg=opt.bg==='none'?6:16;
      const font=`${opt.weight||500} ${fs}px Mitr, Sarabun, sans-serif`;c.font=font;
      let lines=wrap(c,txt,maxW);if(!lines.length)lines=[' '];const dot=opt.dot?fs*.55:0;
      const iw=Math.ceil(Math.max(...lines.map(l=>c.measureText(l).width)))+pad*2+dot;const lh=fs*1.42;const ih=Math.ceil(lines.length*lh+pad*1.1);
      const w=iw+mg*2,h=ih+mg*2;cv.width=w;cv.height=h;c.font=font;
      if(opt.bg!=='none'){
        c.save();c.shadowColor='rgba(10,20,20,.28)';c.shadowBlur=14;c.shadowOffsetY=5;
        c.fillStyle=opt.bg||'rgba(255,255,255,.96)';const r=Math.min(opt.r||ih/2,ih/2,32);const x=mg,y=mg;
        c.beginPath();c.moveTo(x+r,y);c.arcTo(x+iw,y,x+iw,y+ih,r);c.arcTo(x+iw,y+ih,x,y+ih,r);c.arcTo(x,y+ih,x,y,r);c.arcTo(x,y,x+iw,y,r);c.fill();c.restore();
        if(opt.stroke){c.strokeStyle=opt.stroke;c.lineWidth=4;c.stroke()}
      } else {c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=8}
      if(dot){c.fillStyle=opt.dot;c.beginPath();c.arc(mg+pad+dot*.35,h/2,dot*.32,0,Math.PI*2);c.fill()}
      c.fillStyle=opt.color||'#17242A';c.textAlign='center';c.textBaseline='middle';
      lines.forEach((l,i)=>c.fillText(l,w/2+dot/2,mg+pad*.55+lh*(i+.5)));
      tex.needsUpdate=true;const sh=sp.userData.h*(lines.length>1?lines.length*.82:1)*(h/ih);sp.scale.set(sh*w/h,sh,1);sp.userData.base=sp.scale.clone();
    };
    sp.set(text);return sp;
  }
  // a label joined to a point on the model by a thin leader line
  function callout(text,anchor,at,o={}){
    const g=new T.Group();const l=label(text,Object.assign({h:.2,fs:42},o));l.position.copy(at);g.add(l);
    const lg=new T.BufferGeometry().setFromPoints([anchor,at]);const line=new T.Line(lg,new T.LineBasicMaterial({color:0xFFFFFF,transparent:true,opacity:.95,depthTest:false,toneMapped:false}));line.renderOrder=19;g.add(line);
    const d=new T.Mesh(new T.SphereGeometry(.035,12,8),new T.MeshBasicMaterial({color:0xFFFFFF,depthTest:false,toneMapped:false}));d.position.copy(anchor);d.renderOrder=19;g.add(d);
    g.userData.fade=v=>{l.material.opacity=v;line.material.opacity=v*.95;d.material.opacity=v;d.material.transparent=true};return g;
  }
  const lin=h=>new T.Color(h).convertSRGBToLinear();
  function linAll(obj){obj.traverse(o=>{if(!o.material)return;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.userData.lin)return;m.userData.lin=1;
    if(m.isSpriteMaterial){m.toneMapped=false;return}
    if(m.color)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();if(m.isMeshBasicMaterial||m.isPointsMaterial||m.isLineBasicMaterial)m.toneMapped=false})})}
  const lerp=(a,b,t)=>a+(b-a)*t;
  const ease=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};

  /* ---------- models (see models.js) ---------- */
  const MODELS = createModels({ T, label, callout, lin, lerp, ease, S, VID, CARE, ROUTINE, STEPS, STAGES, STAGE_C, STEPW, stageIdx, RBox: RoundedBoxGeometry, getVCH: () => VCH, COUNT_MS });

  /* ---------- model switching ---------- */
  linAll(holder);
  let curName = null;
  function setModel(name, first) {
    if (name === curName && model) return;
    if (model) { outModel = model; outT = 0 }
    curName = name; model = MODELS[name](); linAll(model.group); pivot.add(model.group); model.group.scale.setScalar(.001); popT = first ? -.5 : 0;
    root.position.y = model.baseY; rotX = 0; rotY = first ? -0.9 : -.35; vY = 0; zoom = 1;
    if (model.sync) model.sync();
  }
  function clearModel() { if (model) { pivot.remove(model.group); model = null } if (outModel) { pivot.remove(outModel.group); outModel = null } curName = null; holder.visible = false; holder.removeFromParent(); place.where = null; burstT = -1 }
  out.setModel = setModel; out.clear = clearModel;
  out.burst = () => { burstT = 0; for (let i = 0; i < PN; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * .85 * MS / 1.7; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = Math.random() * .2; pp[i * 3 + 2] = Math.sin(a) * r; pv[i] = .6 + Math.random() * 1.6 } pg.attributes.position.needsUpdate = true };

  /* ---------- where the content sits: on the printed cover, or floating in front of the camera ---------- */
  const place = { where: null, idx: -1, lostTimer: null, chipTimer: null };
  function activeCam() { return camOn ? arCam : prevCam }
  function attach(where) {
    const idx = CONFIG.targets.indexOf(cur); place.idx = idx;
    if (where === 'anchor' && camOn && idx >= 0) {
      anchors[idx].group.add(holder); holder.position.set(0, 0, 0); holder.rotation.set(Math.PI / 2, 0, 0); holder.scale.setScalar(CONFIG.arScale);
    } else {
      (camOn ? floatA : floatP).add(holder); holder.rotation.set(.42, 0, 0); holder.scale.setScalar(CONFIG.arScale);
    }
    holder.visible = true;
    if (place.where === 'anchor' && where === 'float') { popT = Math.min(popT, .2); showChip() }
    place.where = where;
  }
  function showChip() { if (!camOn) return; $('floatChip').hidden = false; clearTimeout(place.chipTimer); place.chipTimer = setTimeout(() => $('floatChip').hidden = true, 3500) }
  out.show = (id, where) => { attach(where) };
  anchors.forEach((a, i) => {
    a.onTargetFound = () => {
      const id = CONFIG.targets[i];
      if (!camOn || !$('start').hidden || !$('settings').hidden || !$('realVid').hidden) return;
      if (cur !== id) { openTopic(id, 'anchor'); return }
      clearTimeout(place.lostTimer); $('floatChip').hidden = true;
      if (!VID.on && place.where !== 'anchor') attach('anchor');
    };
    a.onTargetLost = () => {
      const id = CONFIG.targets[i]; if (cur !== id || place.where !== 'anchor') return;
      clearTimeout(place.lostTimer); place.lostTimer = setTimeout(() => { if (cur === id && !anchors[i].visible) attach('float') }, CONFIG.lostDelay);
    };
  });

  /* ---------- camera on/off ---------- */
  let arStarted = false;
  out.startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('no camera api'), { name: window.isSecureContext ? 'NotFoundError' : 'InsecureContext' });
    // ask for permission first so we can tell the person exactly what went wrong
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    s.getTracks().forEach(t => t.stop());
    previewOn = false;
    await mindar.start(); arStarted = true; camOn = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); mindar.resize();
  };
  out.stopCamera = () => { if (arStarted) { try { mindar.stop() } catch (e) { } arStarted = false } camOn = false };
  out.startPreview = () => { previewOn = true; camOn = false; resizePreview() };
  function resizePreview() {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); prevCam.aspect = w / h; prevCam.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { if (!camOn) resizePreview() });

  /* ---------- touch: drag to turn, pinch to zoom, tap to pick ---------- */
  const ptrs = new Map(); let dragDist = 0, pinch0 = 0, zoom0 = 1;
  container.addEventListener('pointerdown', e => { if (!model) return; try { container.setPointerCapture(e.pointerId) } catch (er) { } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragDist = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zoom } lastInteract = clock.getElapsedTime(); $('hint').classList.remove('show') });
  container.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoom = Math.max(.6, Math.min(1.8, zoom0 * d / pinch0)); return }
    dragDist += Math.abs(dx) + Math.abs(dy); vY = dx * .012; vX = dy * .008; rotY += vY; rotX = Math.max(-.7, Math.min(.9, rotX + vX)); lastInteract = clock.getElapsedTime() });
  const up = e => { const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (p && dragDist < 8 && model && model.pickables) { const r = container.getBoundingClientRect(); const m = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new T.Raycaster(); rc.setFromCamera(m, activeCam()); const hit = rc.intersectObjects(model.pickables, false)[0]; if (hit) pick(...hit.object.userData.pick) } };
  container.addEventListener('pointerup', up); container.addEventListener('pointercancel', up);
  container.addEventListener('wheel', e => { if (!model) return; e.preventDefault(); zoom = Math.max(.6, Math.min(1.8, zoom * (e.deltaY > 0 ? .92 : 1.08))); lastInteract = clock.getElapsedTime() }, { passive: false });

  /* ---------- loop ---------- */
  const clock = new T.Clock(); let fScale = 0, fY = 0;
  function placeFloat(dt) {
    const cam = activeCam(); const f = camOn ? floatA : floatP;
    const d = 1000; const vh = 2 * d * Math.tan(T.MathUtils.degToRad(cam.fov) / 2);
    const H = container.clientHeight || 1; const sheet = VID.on ? 150 : (screen.classList.contains('found') ? $('sheet').offsetHeight : 0);
    // centre the object in the part of the screen the reading sheet leaves free
    const freeTop = 90, freeMid = (freeTop + (H - sheet)) / 2; const yPx = H / 2 - freeMid;
    const vw = vh * (container.clientWidth || 1) / H;
    const tScale = Math.min((VID.on ? .62 : .5) * vh * Math.min(1, (H - sheet - freeTop) / (H * .62)), (VID.on ? 1.1 : .8) * vw);
    fScale = fScale ? lerp(fScale, tScale, Math.min(1, dt * 5)) : tScale; fY = lerp(fY, yPx / H * vh - (VID.on ? .28 : .2) * fScale, Math.min(1, dt * 5));
    f.position.set(0, fY, -d); f.scale.setScalar(fScale);
  }
  let lastR = 0;
  function tick() {
    if (!camOn && !previewOn) { return }
    // with the camera on, draw 3D at most 30 times a second (the camera itself runs at ~30 fps); the rest goes to tracking
    const now = performance.now(); if (camOn && now - lastR < 31) return; lastR = now;
    const dt = Math.min(.05, clock.getDelta()), t = clock.getElapsedTime();
    if (VID.on && place.where === 'anchor') attach('float');
    if (!VID.on && place.where === 'float' && camOn && place.idx >= 0 && anchors[place.idx].visible) attach('anchor');
    placeFloat(dt);
    zoomS = lerp(zoomS, zoom, .18);
    if (burstT >= 0) {
      burstT += dt;
      waves.forEach((w, i) => { const k = Math.max(0, burstT - i * .25) / 1.1; w.scale.setScalar(w.userData.s * (1 + k * 1.4)); w.material.opacity = k > 0 && k < 1 ? (1 - k) * .9 : 0 });
      beam.material.opacity = Math.max(0, .28 * (1 - burstT / 1.2)); beam.scale.set(1, Math.min(1, burstT * 3), 1); beam.position.y = 1.6 * Math.min(1, burstT * 3);
      pts.material.opacity = Math.max(0, 1 - burstT / 2); for (let i = 0; i < PN; i++) { pp[i * 3 + 1] += pv[i] * dt; pp[i * 3] *= 1 + dt * .15; pp[i * 3 + 2] *= 1 + dt * .15 } pg.attributes.position.needsUpdate = true;
      if (burstT > 3) burstT = 3.0001
    }
    ped.material.opacity = lerp(ped.material.opacity, model ? .5 + .12 * Math.sin(t * 2) : 0, Math.min(1, dt * 3)); pedRing.material.opacity = ped.material.opacity * .9; pedRing.scale.setScalar(1 + .04 * Math.sin(t * 2));
    blob.visible = place.where === 'anchor';
    if (outModel) { outT += dt * 4; const s = Math.max(.001, 1 - outT); outModel.group.scale.setScalar(s); if (outT >= 1) { pivot.remove(outModel.group); outModel = null } }
    if (model) {
      if (!outModel) { popT = Math.min(1, popT + dt * 1.4); const k = Math.max(0, popT); model.group.scale.setScalar(Math.max(.001, ease(k) * zoomS)) }
      const idle = t - lastInteract > 2.5;
      if (!ptrs.size) { vY *= .93; vX *= .9; rotY += vY; rotX = Math.max(-.7, Math.min(.9, rotX + vX)); if (idle) { rotX = lerp(rotX, 0, dt * 1.5); if (VID.on) { rotY = lerp(rotY, -.35 + Math.sin(t * .2) * .2, dt * 1.2) } else if (model.spin) rotY += dt * .35; else rotY = lerp(rotY, Math.sin(t * .25) * .35, dt * .8) } }
      pivot.rotation.set(rotX + (model.tilt || 0), rotY, 0);
      const rise = popT < 1 ? (1 - ease(Math.max(0, popT))) * -.6 : 0; root.position.y = model.baseY + (model.noBob ? 0 : Math.sin(t * 1.5) * .05) + rise;
      model.update(t, dt); if (outModel && outModel.update) outModel.update(t, dt);
    }
    perf.n++; perf.t += dt;
    if (perf.t > 2) { const fps = perf.n / perf.t; perf.n = 0; perf.t = 0;
      if (fps < 26 && perf.pr > 1) { perf.pr = Math.max(1, perf.pr - .25); renderer.setPixelRatio(perf.pr); renderer.setSize(container.clientWidth, container.clientHeight, !camOn) }
      else if (fps > 50 && perf.pr < perf.max) { perf.pr = Math.min(perf.max, perf.pr + .25); renderer.setPixelRatio(perf.pr); renderer.setSize(container.clientWidth, container.clientHeight, !camOn) } }
    renderer.render(scene, activeCam());   // after any resize, so a resized canvas is never shown empty
  }
  const perf = { n: 0, t: 0, max: Math.min(window.devicePixelRatio || 1, 2), pr: Math.min(window.devicePixelRatio || 1, 2) };
  out.renderer = renderer;
  renderer.setAnimationLoop(tick);
  return out;
})();

/* ================= go ================= */
buildCovers(); setPP(); toggleMute(); toggleMute();
if (document.fonts && document.fonts.load) { document.fonts.load('500 44px Mitr').catch(() => { }) }
window.__AR = { G, openTopic, MODE, P, VID, S, get cur() { return cur } };   // for testing
