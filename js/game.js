// COLONIZATION — interfaz, flujo de turnos, modos de juego
'use strict';
(function(){
const VERSION='v2.4 · 2026-10-21 11:53';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let autoEndTimer=null;
let map,st=null,mode=null,lastT=0,timerLeft=0,paused=false,pendingMsgs=[],user='',tipShown={};
const canvas=$('#map');
function resize(){const wrap=$('#mapwrap');canvas.width=wrap.clientWidth*devicePixelRatio;canvas.height=wrap.clientHeight*devicePixelRatio;canvas.style.width=wrap.clientWidth+'px';canvas.style.height=wrap.clientHeight+'px';if(map)map.fit();}
window.addEventListener('resize',resize);
// ---------- boot ----------
function useBoard(key){if(map)map.revertAll();const b=COPAHUE.boards[key]||COPAHUE.boards.m;COPAHUE.cols=b.cols;COPAHUE.rows=b.rows;COPAHUE.hexes=b.hexes;COPAHUE.siteHex=b.siteHex;COPAHUE.elev=b.elev;map=new HexMap.HexMapRenderer(COPAHUE,canvas);resize();}
function boot(){useBoard('m');document.querySelectorAll('.ver').forEach(e=>e.textContent=VERSION);document.title='COLONIZATION '+VERSION.split(' · ')[0];applyLang();showTitle();requestAnimationFrame(loop);
  canvas.addEventListener('mousemove',e=>{const [x,y]=pt(e);if(drag.on){map.ox+=(e.clientX-drag.x)*devicePixelRatio;map.oy+=(e.clientY-drag.y)*devicePixelRatio;drag.x=e.clientX;drag.y=e.clientY;drag.moved=true;return;}map.hover=map.hexAt(x,y);if(map.hover>=0&&!st?.hexes[map.hover])map.hover=-1;});
  canvas.addEventListener('mousedown',e=>{hidePopup();drag.on=true;drag.x=e.clientX;drag.y=e.clientY;drag.moved=false;});
  window.addEventListener('mouseup',e=>{if(drag.on&&!drag.moved&&e.target===canvas){const [x,y]=pt(e);clickHex(map.hexAt(x,y));}drag.on=false;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=pt(e);const z0=map.zoom;map.zoom=HexMap.clamp(map.zoom*(e.deltaY<0?1.12:.89),.6,3.5);const k=map.zoom/z0;map.ox=x-(x-map.ox)*k;map.oy=y-(y-map.oy)*k;},{passive:false});
  canvas.addEventListener('mouseleave',()=>{map.hover=-1;});
  document.addEventListener('keydown',onKey);
  document.body.addEventListener('pointerdown',()=>{Audio_.resume();},{once:true});
}
const drag={on:false,x:0,y:0,moved:false};
function pt(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*devicePixelRatio,(e.clientY-r.top)*devicePixelRatio];}
function loop(t){const dt=Math.min(.05,(t-lastT)/1000||0);lastT=t;if(st&&!paused&&!st.over&&st.mode==='quick'&&timerLeft>0&&!$('#modal').classList.contains('open')){timerLeft-=dt;$('#timer').textContent=Math.ceil(timerLeft)+'s';$('#timer').classList.toggle('warn',timerLeft<15);if(timerLeft<=0){toast(T('autoEnd'));endTurn();}}
  if(st){st.targets=mode?(mode.targets||null):(st.over?null:Object.keys(autoTargets()).map(Number));st.me=st.human;st.prep=mode&&mode.kind==='prepare'?{cands:Rules.prepareCandidates(st.human,st,map,mode.picked),picked:mode.picked}:null;}map.draw(st,dt);if(st)FX.draw(map.ctx,map,dt,canvas.width,canvas.height);punch(dt);requestAnimationFrame(loop);}
let punchT=0,punchI=-1;function punch(dt){if(punchT<=0)return;punchT-=dt;}
function zoomTo(i){const [x,y]=map.center(i);const W=canvas.width,H=canvas.height;const dx=W/2-x,dy=H/2-y;const steps=18;let k=0;const ox0=map.ox,oy0=map.oy;const tick=()=>{k++;const e=k/steps;const ee=e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2;map.ox=ox0+dx*.35*ee;map.oy=oy0+dy*.35*ee;if(k<steps)requestAnimationFrame(tick);};tick();}
// hexes a los que puedes ir ahora mismo: {target: mejorOrigen}
function autoTargets(){const me=st.human,P=st.factions[me];const out={};if(P.actions<=0||P.res.energy<3)return out;
  for(const i of map.playable){const s=st.hexes[i];if(s.owner!==me||s.pop<3)continue;for(const j of Rules.colonizeTargets(me,st,i,map)){const t=st.hexes[j];const p=t.owner&&t.owner!==me?Rules.combat(me,st,i,j,map):Rules.colonizeOdds(me,st,i,j,map);if(!out[j]||p>out[j].p)out[j]={from:i,p};}}
  return out;}
// ---------- title ----------
function showTitle(){$('#title').classList.add('open');$('#game').classList.remove('open');st=null;renderUsers();}
function renderUsers(){user=user||Save.lastUser();const us=Save.users();const box=$('#users');box.innerHTML='';us.forEach(u=>{const b=document.createElement('button');b.className='chip'+(u===user?' sel':'');b.textContent=u;b.onclick=()=>{user=u;Save.addUser(u);renderUsers();};box.appendChild(b);});
  const inp=document.createElement('input');inp.placeholder=T('newUser');inp.maxLength=24;inp.onkeydown=e=>{if(e.key==='Enter'){const n=Save.addUser(inp.value);if(n){user=n;renderUsers();}}};box.appendChild(inp);
  const saves=user?Save.list(user).concat([(()=>{const l=Save.load(user,'learn');return {mode:'learn',t:l?l.t:null,turn:l?l.state.turn:null,faction:l?l.state.human:null,over:l?l.state.over:false};})()]):[];const sv=$('#saves');sv.innerHTML='';saves.forEach(s=>{if(!s.t)return;const d=new Date(s.t);const b=document.createElement('button');b.className='big';b.innerHTML=`<b>${T('continue')} · ${T(s.mode)}</b><small>${esc(L(FBY[s.faction].name))} · ${T('turn')} ${s.turn} · ${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0,5)}${s.over?' · '+T('gameOver'):''}</small>`;b.onclick=()=>{const l=Save.load(user,s.mode);if(l)startFromState(l.state);};sv.appendChild(b);});
  $('#btnQuick').disabled=$('#btnCampaign').disabled=$('#btnLearn').disabled=!user;$('#whoPlays').textContent=user?user:'—';}
$('#btnLearn').onclick=()=>chooseFaction('learn');$('#btnQuick').onclick=()=>chooseFaction('quick');$('#btnCampaign').onclick=()=>chooseFaction('campaign');
function chooseFaction(m){const box=$('#factions');box.innerHTML='';FACTIONS.forEach(f=>{const c=document.createElement('div');c.className='fcard';c.style.setProperty('--fc',f.color);
    c.innerHTML=`<div class="ficon">${f.icon}</div><div class="fname">${esc(L(f.name))}</div><div class="fshort">${esc(L(f.short))}</div><div class="fchips"><span>pH ${f.phOpt}</span><span>${f.tOpt} °C</span><span>${f.metab==='auto'?'🌋':f.metab==='hetero'?'🍽':'🔀'}</span></div><div class="ftax">${esc(f.taxon)}</div>`;
    c.onclick=()=>{Audio_.resume();Audio_.sfx('click');startNew(m,f.id);};box.appendChild(c);});$('#pick').classList.add('open');$('#pickMode').textContent=T(m);}
$('#pickClose').onclick=()=>$('#pick').classList.remove('open');
function startNew(m,fid){$('#pick').classList.remove('open');const bk=m==='learn'?'s':m==='quick'?'m':'l';useBoard(bk);const s=Rules.newState(map,{mode:m,faction:fid,user,board:bk});Rules.effective(s,map);startFromState(s);const F=FBY[fid];adviser(L({es:`${F.icon} Tú eres <b>${esc(L(F.name))}</b>. Tu casa es ${F.home} (bandera). Haz clic en un hex que brilla para colonizarlo.`,en:`${F.icon} You are <b>${esc(L(F.name))}</b>. Home is ${F.home} (flag). Click a glowing hex to colonize it.`}));openTutorial();}
function openTutorial(pause){const F=FBY[st.human];openModal(`${pause?`<div class="pausebig">⏸ ${L({es:'PAUSA',en:'PAUSED'})}</div>`:''}<h3>${F.icon} ${L({es:'Cómo se juega',en:'How to play'})}</h3><div class="tut">
  <div><span class="n">🚩</span><div>${L({es:`Eres <b style="color:${F.color}">${esc(L(F.name))}</b>. Tus hexes tienen tu color; la bandera <b>TÚ</b> es tu casa.`,en:`You are <b style="color:${F.color}">${esc(L(F.name))}</b>. Your hexes carry your colour; the <b>YOU</b> flag is home.`})}</div></div>
  <div><span class="n">7</span><div>${L({es:'El <b>número</b> en cada hex es la <b>población</b> que vive ahí (máx. 10). Con <b>3 o más</b> puedes saltar a un hex vecino.',en:'The <b>number</b> in each hex is the <b>population</b> living there (max 10). With <b>3 or more</b> you can jump to a neighbouring hex.'})}</div></div>
  <div><span class="n">+</span><div>${L({es:'Haz clic en un hex que <b>brilla</b> para colonizarlo. Clic en cualquier hex abre un menú con más opciones (Biofilm, Vesículas, Preparar agua).',en:'Click a <b>glowing</b> hex to colonize it. Clicking any hex opens a menu with more options (Biofilm, Vesicles, Prepare water).'})}</div></div>
  <div><span class="n">3</span><div>${L({es:'<b>3 acciones</b> por turno (6 en el primero; ●●● arriba): colonizar, preparar agua, biofilm o vesículas, en el orden que quieras. Al gastarlas, el turno pasa solo.',en:'<b>3 actions</b> per turn (6 on the first; ●●● top bar): colonize, prepare water, biofilm or vesicles in any order. When spent, the turn ends by itself.'})}</div></div>
  <div><span class="n">⏎</span><div>${L({es:'<b>Enter</b> = pausa y estas instrucciones. <b>Esc</b> = menú.',en:'<b>Enter</b> = pause and these instructions. <b>Esc</b> = menu.'})}</div></div></div>
  <button id="tutOk" class="go">${pause?L({es:'▶ Seguir jugando',en:'▶ Resume'}):L({es:'¡Entendido, a jugar!',en:'Got it, let’s play!'})}</button>`,false);$('#tutOk').onclick=closeModal;}
function startFromState(s){useBoard(s.board||'m');st=s;mode=null;st.markers=st.markers||[];Rules.applyMade(s,map);hidePopup();if(!$('#adviser').innerHTML)$('#adviser').style.display='none';paused=false;$('#title').classList.remove('open');$('#game').classList.add('open');resize();map.sel=-1;timerLeft=st.timer||0;Audio_.resume();Audio_.setMusic({faction:st.human,era:st.era||0,war:humanAtWar()});refresh();selectHex(COPAHUE.siteHex[FBY[st.human].home]);if(st.over)showGameOver();}
// ---------- HUD ----------
function refresh(){if(!st)return;const P=st.factions[st.human],F=FBY[st.human];
  $('#hudFaction').innerHTML=`<span class="dot" style="background:${F.color}"></span>${F.icon} ${esc(L(F.name))} · <small>${esc(user)}</small>`;
  $('#hudTurn').textContent=`${T('turn')} ${Math.min(st.turn,st.maxTurns)}/${st.maxTurns}`;$('#hudEra').textContent=T('eraNames')[st.era||0];
  $('#hudRes').innerHTML=`<span title="${T('energy')}">⚡ ${P.res.energy.toFixed(0)}</span><span title="${T('carbon')}">🟢 ${P.res.carbon.toFixed(0)}</span><span title="${T('actions')}" class="acts-dots">🎯 ${'●'.repeat(P.actions)}${'○'.repeat(Math.max(0,(st.turn===1?6:3)-P.actions))}</span><span>🗺 ${Rules.territory(st,st.human)}/${map.playable.length}</span>`;
  $('#cdgBtn').innerHTML=`${P.cdg==='high'?T('cdgHigh'):T('cdgLow')}${P.cdgPending?' ⏳':''}`;$('#cdgBtn').className='cdg '+P.cdg;
  $('#timer').style.display=st.mode==='quick'?'':'none';
  renderLog();if(map.sel>=0)renderHex(map.sel);
  const era=Rules?st.era:0;Audio_.setMusic({era:st.era||0,war:humanAtWar()});
  $('#btnPause').style.display=st.mode==='campaign'?'':'none';$('#btnEnd').classList.toggle('pulse',P.actions<=0&&!st.over);
  if(P.actions<=0&&!st.over&&!autoEndTimer&&!mode){autoEndTimer=setTimeout(()=>{autoEndTimer=null;if(st&&!st.over&&st.factions[st.human].actions<=0&&!$('#modal').classList.contains('open'))endTurn();else refresh();},1400);toast(L({es:'⏳ Sin acciones: pasando el turno…',en:'⏳ No actions left: ending turn…'}),1300);}
  $('#hudFaction').innerHTML=`<b>${L({es:'TÚ',en:'YOU'})}:</b> <span class="dot" style="background:${F.color}"></span>${F.icon} ${esc(L(F.name))}`;}
function humanAtWar(){return Object.keys(st.wars).some(k=>k.split('|').indexOf(st.human)>=0);}
function renderLog(){const box=$('#log');const items=st.log.slice(-6).reverse();box.innerHTML=items.map(e=>`<div class="le">${logText(e)}</div>`).join('');}
function fname(f){const F=FBY[f];return `<b style="color:${F.color}">${esc(L(F.name))}</b>`;}
function hexName(i){const h=COPAHUE.hexes[i];return h.site?`${h.site} (${esc(COPAHUE.sites[h.site]?L({es:COPAHUE.sites[h.site].name,en:COPAHUE.sites[h.site].name}):h.site)})`:esc(h.river||'')+` [${h.c},${h.r}]`;}
function logText(e){const d=e.data;const t=`<small>T${e.turn}</small> `;switch(e.kind){
  case 'colonized':return t+L({es:`${fname(d.f)} colonizó ${hexName(d.to)}.`,en:`${fname(d.f)} colonized ${hexName(d.to)}.`});
  case 'failed':return t+L({es:`${fname(d.f)} fracasó al colonizar ${hexName(d.to)}.`,en:`${fname(d.f)} failed to colonize ${hexName(d.to)}.`});
  case 'won':return t+L({es:`⚔️ ${fname(d.f)} desplazó a ${fname(d.d)} de ${hexName(d.to)}.`,en:`⚔️ ${fname(d.f)} displaced ${fname(d.d)} from ${hexName(d.to)}.`});
  case 'lost':return t+L({es:`🛡 ${fname(d.d)} resistió a ${fname(d.f)} en ${hexName(d.to)}.`,en:`🛡 ${fname(d.d)} resisted ${fname(d.f)} at ${hexName(d.to)}.`});
  case 'biofilm':return t+L({es:`${fname(d.f)}: biofilm nivel ${d.lvl} en ${hexName(d.i)}.`,en:`${fname(d.f)}: biofilm level ${d.lvl} at ${hexName(d.i)}.`});
  case 'gene':return t+L({es:`🧬 ${fname(d.f)} adquirió ${GBY[d.g].icon} <i>${esc(L(GBY[d.g].short||GBY[d.g].name))}</i>.`,en:`🧬 ${fname(d.f)} acquired ${GBY[d.g].icon} <i>${esc(L(GBY[d.g].short||GBY[d.g].name))}</i>.`});
  case 'omvGift':return t+L({es:`🎁 ${fname(d.f)} envió vesículas con enzimas a ${fname(d.d)}.`,en:`🎁 ${fname(d.f)} sent enzyme vesicles to ${fname(d.d)}.`});
  case 'omvToxin':return t+L({es:`☠️ ${fname(d.f)} lanzó vesículas tóxicas contra ${fname(d.d)} en ${hexName(d.to)}.`,en:`☠️ ${fname(d.f)} fired toxic vesicles at ${fname(d.d)} in ${hexName(d.to)}.`});
  case 'omvShield':return t+L({es:`🛡 ${fname(d.f)} liberó vesículas señuelo en ${hexName(d.to)}: inmune a fagos.`,en:`🛡 ${fname(d.f)} released decoy vesicles at ${hexName(d.to)}: phage-immune.`});
  case 'omvGene':return t+L({es:`🧬 ${fname(d.f)} regaló el gen <i>${esc(L(GBY[d.gene].name))}</i> a ${fname(d.d)}.`,en:`🧬 ${fname(d.f)} gifted gene <i>${esc(L(GBY[d.gene].name))}</i> to ${fname(d.d)}.`});
  case 'omvDNA':return t+L({es:`🧬 ${fname(d.f)} dejó ADN de <i>${esc(L(GBY[d.gene].name))}</i> en territorio de ${fname(d.d)}.`,en:`🧬 ${fname(d.f)} left DNA of <i>${esc(L(GBY[d.gene].name))}</i> in ${fname(d.d)} territory.`});
  case 'prepare':return t+L({es:`🏗️ ${fname(d.f)} preparó ${d.n} casilla(s) de agua cerca de ${hexName(d.i)}.`,en:`🏗️ ${fname(d.f)} prepared ${d.n} water tile(s) near ${hexName(d.i)}.`});
  case 'war':return t+L({es:`⚔️ ${fname(d.f)} declaró la guerra a ${fname(d.d)}.`,en:`⚔️ ${fname(d.f)} declared war on ${fname(d.d)}.`});
  case 'ally':return t+L({es:`🤝 Sintrofia entre ${fname(d.f)} y ${fname(d.d)}.`,en:`🤝 Syntrophy between ${fname(d.f)} and ${fname(d.d)}.`});
  case 'peace':return t+L({es:`🕊 Paz entre ${fname(d.f)} y ${fname(d.d)}.`,en:`🕊 Peace between ${fname(d.f)} and ${fname(d.d)}.`});
  case 'extinct':return t+L({es:`💀 ${fname(d.f)} se extinguió del río.`,en:`💀 ${fname(d.f)} went extinct from the river.`});
  case 'event':{const ev=EVENTS.find(x=>x.id===d.id);return t+`🌋 <b>${esc(L(ev.name))}</b>${d.hex!==undefined?' · '+hexName(d.hex):''}`;}
  default:return t+e.kind;}}
function toast(msg,ms){const tb=$('#toast');tb.innerHTML=msg;tb.classList.add('show');clearTimeout(tb._t);tb._t=setTimeout(()=>tb.classList.remove('show'),ms||2200);}
function adviser(msg){$('#adviser').style.display='';$('#adviser').innerHTML=`<b>🔬 ${T('adviser')}:</b> ${msg}`;}
// ---------- hex panel ----------
function clickHex(i){if(i<0||!st)return;Audio_.sfx('click');
  if(mode&&mode.kind==='prepare'){pickPrepare(i);return;}
  if(mode){if(mode.targets.indexOf(i)>=0){execTarget(i);}else{cancelMode();selectHex(i);}return;}
  if(mode&&mode.kind==='prepare'){pickPrepare(i);return;}
  selectHex(i);popupFor(i);}
// menú emergente sobre el hex
function popupFor(i){const pop=$('#popup');const me=st.human;if(!st||st.over){pop.style.display='none';return;}const s=st.hexes[i];const h=COPAHUE.hexes[i];const P=st.factions[me];const at=autoTargets()[i];const F=FBY[me];
  let items=[];
  if(s&&s.owner===me){const cb=Rules.canBiofilm(me,st,i);items.push({ic:'🧱',t:T('biofilm')+' '+s.biofilm+'→'+Math.min(3,s.biofilm+1),sub:'🟢'+Rules.biofilmCost(me,st,i)+(cb==='cdg'?' · '+L({es:'solo en modo 🛡',en:'only in 🛡 mode'}):cb==='max'?' · max':''),dis:cb!=='ok',act:()=>hexAction('biofilm',i)});
    items.push({ic:'💧',t:T('omv'),sub:'🟢3',dis:P.actions<=0||P.res.carbon<3,act:()=>openOMV(i)});
    const cp=Rules.canPrepare(me,st);items.push({ic:'🏗️',t:L({es:'Preparar agua',en:'Prepare water'}),sub:cp==='ok'?L({es:'hasta 3 casillas · 🟢3 c/u · 1 acción',en:'up to 3 tiles · 🟢3 each · 1 action'}):T(cp),dis:cp!=='ok',act:()=>startPrepare()});}
  else if(s&&at){items.push({ic:s.owner?'⚔️':'🧫',t:(s.owner?T('attack'):T('colonize'))+' '+((at.p*100)|0)+' %',sub:'⚡3 · 1 '+L({es:'acción',en:'action'}),dis:false,act:()=>{mode={kind:'colonize',from:at.from,targets:[i]};execTarget(i);}});
    if(s.owner&&s.owner!==me){items.push({ic:'☠️',t:T('omvToxin'),sub:'🟢3',dis:P.actions<=0||P.res.carbon<3,act:()=>{mode={kind:'omv',from:at.from,type:'toxin',targets:[i]};execTarget(i);}});}}
  else if(s){const near=map.nbr[i].some(j=>st.hexes[j]&&st.hexes[j].owner===me);const why=P.actions<=0?T('noActions'):P.res.energy<3?'⚡ '+T('notEnough'):near?L({es:'tu hex vecino necesita población ≥ 3 (espera un turno)',en:'your neighbouring hex needs population ≥ 3 (wait a turn)'}):L({es:'coloniza primero un hex vecino',en:'colonize a neighbouring hex first'});items.push({ic:'🚫',t:L({es:'Fuera de alcance',en:'Out of reach'}),sub:why,dis:true});}
  else if(h.t==='land'&&Rules.prepareCandidates(me,st,map).indexOf(i)>=0){const cp=Rules.canPrepare(me,st);items.push({ic:'🏗️',t:L({es:'Preparar agua aquí',en:'Prepare water here'}),sub:cp==='ok'?L({es:'crea una poza con tu química',en:'make a pool with your chemistry'}):T(cp),dis:cp!=='ok',act:()=>startPrepare(i)});}
  else if(!s){pop.style.display='none';return;}
  // información
  const site=h.site?COPAHUE.sites[h.site]:null;const e=s.eff;const fit=Rules.fitness(me,st,i,map);const fc=fit>.6?'#3fbf8f':fit>.3?'#f2c230':'#c8401a';
  let info=`<div class="ptitle">${site?esc(site.name):esc(h.river||typeName(h))}${h.site?` <span class="code">${h.site}</span>`:''}</div>`;
  if(h.site&&PHOTOS[h.site])info+=`<img class="photo" src="${PHOTOS[h.site]}" alt="${h.site}">`;
  info+=`<div class="chem"><span>🧪 pH <b>${e.ph.toFixed(1)}</b></span><span>🌡️ <b>${e.T.toFixed(0)} °C</b></span><span>🧲 Fe <b>${fmt(e.fe)}</b></span><span>🫧 O₂ <b>${fmt(e.o2)} %</b></span></div>`;
  const own=s.owner?`${FBY[s.owner].icon} ${fname(s.owner)}${s.owner===me?' ('+T('yours')+')':''}`:`<i>${T('empty')}</i>`;
  info+=`<div class="own">${own} · 👥 <b>${Math.round(s.pop)}</b>/${Rules.capacity(st,i,map).toFixed(0)} · 🧱 ${T('biofilmLvl')[s.biofilm]}${s.shield?' · 🛡'+s.shield:''}${h.madeBy?` · 🏗️ ${FBY[h.madeBy].icon}`:''}</div>`;
  info+=`<div class="fit">${F.icon} ${T('fitness')}: <div class="bar"><i style="width:${(fit*100)|0}%;background:${fc}"></i></div> <b>${(fit*100)|0} %</b></div>`;
  const [x,y]=map.center(i);const r=canvas.getBoundingClientRect();const wrap=$('#mapwrap').getBoundingClientRect();const px=x/devicePixelRatio+r.left-wrap.left,py=y/devicePixelRatio+r.top-wrap.top;
  pop.innerHTML=info+`<div class="pacts">`+items.map((it,k)=>`<button data-k="${k}" ${it.dis?'disabled':''}><span>${it.ic}</span><div><b>${it.t}</b><small>${it.sub||''}</small></div></button>`).join('')+`</div><button class="pclose" id="pClose">✕</button>`;
  pop.style.display='block';const pw=pop.offsetWidth,ph=pop.offsetHeight;const hs=map.size*map.zoom/devicePixelRatio;const notesB=($('#notes').getBoundingClientRect().bottom-wrap.top)+6;const logR=$('#log').getBoundingClientRect();const logTop=logR.top-wrap.top-6,logRight=logR.right-wrap.left+6;
  let lx=px+hs*.95,ly=py-ph/2;if(lx+pw>wrap.width-10)lx=px-pw-hs*.95;if(lx<8)lx=8;ly=Math.max(notesB,Math.min(wrap.height-ph-8,ly));
  if(lx<logRight&&ly+ph>logTop){const up=logTop-ph;if(up>=notesB)ly=up;else lx=Math.min(wrap.width-pw-8,logRight);}
  pop.style.left=lx+'px';pop.style.top=ly+'px';
  $('#pClose').onclick=hidePopup;pop.querySelectorAll('[data-k]').forEach(b=>b.onclick=e=>{e.stopPropagation();pop.style.display='none';items[+b.dataset.k].act();});}
function hidePopup(){$('#popup').style.display='none';}
// modo preparar: elegir hasta 3 casillas de tierra pegadas a tu territorio
function startPrepare(first){mode={kind:'prepare',picked:[],targets:null};hidePopup();const bar=$('#prepbar');bar.style.display='flex';updatePrepBar();if(first!==undefined)pickPrepare(first);toast(L({es:'Haz clic en las casillas azules 💧 (hasta 3) y confirma.',en:'Click the blue 💧 tiles (up to 3) and confirm.'}),4000);}
function pickPrepare(i){const c=Rules.prepareCandidates(st.human,st,map,mode.picked);const k=mode.picked.indexOf(i);if(k>=0){mode.picked.splice(k,1);}else if(c.indexOf(i)>=0&&mode.picked.length<3){if((mode.picked.length+1)*3>st.factions[st.human].res.carbon){toast('🟢 '+T('notEnough'));return;}mode.picked.push(i);}else{Audio_.sfx('fail');}updatePrepBar();}
function updatePrepBar(){const n=mode?mode.picked.length:0;const ok=n*3<=st.factions[st.human].res.carbon;$('#prepCount').innerHTML=`${n}/3 · <span style="color:${ok?'#9f9':'#f88'}">🟢${n*3}</span>`;$('#prepOk').disabled=n===0||!ok;}
$('#prepOk').onclick=()=>{if(!mode||mode.kind!=='prepare')return;const r=Rules.doPrepare(st.human,st,mode.picked,map);if(r.ok){Audio_.sfx('biofilm');for(const i of mode.picked){map.spawn(i,'gift',8);}FX.play('prepare',mode.picked[0],{color:FBY[st.human].color,flag:Rules.has(st,st.human,'flagellum'),water:HexMap.waterColor(st.hexes[mode.picked[0]].eff),text:'💧 '+L({es:'Agua preparada',en:'Water prepared'})});toast(L({es:'💧 Agua preparada con tu química. ¡Ahora colonízala antes que otros!',en:'💧 Water prepared with your chemistry. Colonize it before others do!'}),3500);}else toast(T(r.msg));cancelMode();refresh();};
$('#prepCancel').onclick=()=>{cancelMode();};
function selectHex(i){map.sel=i;renderHex(i);}
function renderHex(i){const h=COPAHUE.hexes[i],s=st.hexes[i];if(!s){$('#hexpanel').innerHTML=`<div class="muted">${T('selectHex')}</div>`;return;}
  const me=st.human;const F=FBY[me];const fit=Rules.fitness(me,st,i,map);const e=s.eff;const site=h.site?COPAHUE.sites[h.site]:null;
  let html=`<div class="hname">${site?esc(site.name):esc(h.river||'')}</div><div class="htype">${typeName(h)}${h.site?' · '+h.site:''}</div>`;
  if(h.site&&PHOTOS[h.site])html+=`<img class="photo" src="${PHOTOS[h.site]}" alt="${h.site}">`;
  html+=`<div class="chem"><span title="${T('ph')}">🧪 pH <b>${e.ph.toFixed(1)}</b></span><span title="${T('temp')}">🌡️ <b>${e.T.toFixed(0)} °C</b></span><span title="${T('fe')}">🧲 Fe <b>${fmt(e.fe)}</b></span><span title="${T('o2')}">🫧 O₂ <b>${fmt(e.o2)} %</b></span></div>`;
  const own=s.owner?`${FBY[s.owner].icon} ${fname(s.owner)}${s.owner===me?' ('+T('yours')+')':''}`:`<i>${T('empty')}</i>`;
  html+=`<div class="own">${own}<br>👥 <b>${Math.round(s.pop)}</b> / ${Rules.capacity(st,i,map).toFixed(0)} · 🧱 ${T('biofilmLvl')[s.biofilm]}${s.shield?' · 🛡'+s.shield:''}${s.eDNA?` · 🧬 <i>${esc(L(GBY[s.eDNA.gene].short||GBY[s.eDNA.gene].name))}</i>`:''}</div>`;
  const fc=fit>.6?'#3fbf8f':fit>.3?'#f2c230':'#c8401a';
  html+=`<div class="fit">${F.icon} ${T('fitness')}: <div class="bar"><i style="width:${(fit*100)|0}%;background:${fc}"></i></div> <b>${(fit*100)|0} %</b></div>`;
  const P=st.factions[me];
  if(s.owner===me&&!st.over){html+=`<div class="acts big3">`;
    html+=`<button ${s.pop<3?'disabled':''} data-act="colonize"><span class="bi">🧫</span>${T('colonize')}<small>⚡3</small></button>`;
    const cb=Rules.canBiofilm(me,st,i);html+=`<button ${cb!=='ok'?'disabled':''} data-act="biofilm" title="${cb}"><span class="bi">🧱</span>${T('biofilm')}<small>🟢${Rules.biofilmCost(me,st,i)}${cb==='cdg'?' · 🛡':cb==='max'?' · max':''}</small></button>`;
    html+=`<button data-act="omv"><span class="bi">💧</span>${T('omv')}<small>🟢3</small></button></div>`;}
  else if(!st.over){const at=autoTargets()[i];if(at)html+=`<button class="go" data-act="go">🧫 ${s.owner?T('attack'):T('colonize')} <b>${(at.p*100)|0} %</b><small>⚡3 · 1 ${L({es:'acción',en:'action'})}</small></button>`;
    else html+=`<div class="hint">${P.actions<=0?'⏳ '+T('noActions')+'. '+L({es:'Pulsa Terminar turno.',en:'Press End turn.'}):P.res.energy<3?'⚡ '+T('notEnough'):L({es:'Fuera de alcance: primero coloniza un hex vecino (los que brillan).',en:'Out of reach: first colonize a neighbouring hex (the glowing ones).'})}</div>`;}
  if(h.site&&COPAHUE.taxa[h.site]){const tx=COPAHUE.taxa[h.site];html+=`<div class="taxa"><div class="muted small">🔬 ${T('metagenome')} ${h.site}</div>`+tx.genus.slice(0,4).map(([g,p])=>`<div class="tx"><span>${esc(g)}</span><div class="bar"><i style="width:${Math.min(100,p*2)|0}%;background:${genusColor(g)}"></i></div><small>${p.toFixed(0)} %</small></div>`).join('')+`</div>`;}
  $('#hexpanel').innerHTML=html;
  $$('#hexpanel [data-act]').forEach(b=>b.onclick=()=>hexAction(b.dataset.act,i));}
function fmt(v){return v===undefined||v===null?'–':(v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2));}
function typeName(h){const m={river:{es:'Río',en:'River'},lake:{es:'Lago',en:'Lake'},crater:{es:'Laguna del cráter',en:'Crater lake'},spring:{es:'Vertiente ácida caliente',en:'Hot acid spring'},falls:{es:'Cascada / salto',en:'Waterfall'},hot:{es:'Terma neutra',en:'Neutral hot spring'},pond:{es:'Laguna',en:'Pond'},fumarole:{es:'Solfatara',en:'Solfatara'},land:{es:'Tierra',en:'Land'}};return L(m[h.t]||m.land);}
function genusColor(g){const m={Acidithiobacillus:'#f2c230',Leptospirillum:'#c8401a',Ferroplasma:'#c8401a',Sulfobacillus:'#b56cf0',Thiomonas:'#b56cf0',Acidiphilium:'#3fbf8f',Acidocella:'#3fbf8f',Ferrovum:'#8a6a2a',Limnohabitans:'#3a8ef0',Polynucleobacter:'#3a8ef0',Flavobacterium:'#3a8ef0'};return m[g]||'#999';}
function hexAction(act,i){const me=st.human;
  if(act==='go'){const at=autoTargets()[i];if(at){mode={kind:'colonize',from:at.from,targets:[i]};execTarget(i);}return;}
  if(act==='colonize'){const tg=Rules.colonizeTargets(me,st,i,map);if(!tg.length){toast(T('tooFar'));return;}mode={kind:'colonize',from:i,targets:tg};toast(L({es:'Elige el hex destino (brillante). Esc cancela.',en:'Pick a target hex (glowing). Esc cancels.'}),4000);}
  if(act==='biofilm'){const r=Rules.doBiofilm(me,st,i);if(r.ok){Audio_.sfx('biofilm');map.spawn(i,'bio',10);FX.play('biofilm',i,{color:FBY[me].color,level:st.hexes[i].biofilm,water:HexMap.waterColor(st.hexes[i].eff),text:'🧱 '+T('biofilm')+' '+st.hexes[i].biofilm});}else toast(T(r.msg));refresh();}
  if(act==='omv'){openOMV(i);}}
function execTarget(j){const me=st.human;
  if(mode.kind==='colonize'){const from=mode.from;const wasOwned=st.hexes[j].owner;const p=wasOwned&&wasOwned!==me?Rules.combat(me,st,from,j,map):Rules.colonizeOdds(me,st,from,j,map);const r=Rules.doColonize(me,st,from,j,map);
    if(!r.ok){toast(T(r.msg));cancelMode();return;}
    const F=FBY[me];const wc=HexMap.waterColor(st.hexes[j].eff);
    if(wasOwned){Audio_.sfx('battle');map.spawn(j,'battle',12);FX.play('attack',j,{color:F.color,color2:FBY[wasOwned].color,flag:Rules.has(st,me,'flagellum'),won:r.won,water:wc,text:r.won?'⚔️ '+T('won'):'🛡 '+T('lost'),textColor:r.won?'#9f9':'#f88'});}
    else{if(r.won){Audio_.sfx('colonize');map.spawn(j,'colonize',10);FX.play('colonize',j,{color:F.color,flag:Rules.has(st,me,'flagellum'),water:wc,text:'🧫 '+T('success'),textColor:'#9f9'});}else{Audio_.sfx('fail');FX.play('fail',j,{color:F.color,water:wc,text:T('fail')+` (${(p*100)|0} %)`,textColor:'#f88'});}}
    cancelMode();selectHex(j);refresh();return;}
  if(mode.kind==='omv'){const r=Rules.doOMV(me,st,mode.from,j,mode.type,map,mode.gene);if(!r.ok)toast(T(r.msg));else{Audio_.sfx('omv');map.spawn(j,mode.type==='toxin'?'toxin':mode.type==='dna'?'dna':'gift',10);FX.play('omv',j,{color:FBY[me].color,type:mode.type,water:HexMap.waterColor(st.hexes[j].eff),text:'💧 '+T('omv')});}cancelMode();refresh();}}
function cancelMode(){mode=null;$('#prepbar').style.display='none';hidePopup();}
function openOMV(i){const me=st.human;const tg=Rules.omvTargets(me,st,i,map);const P=st.factions[me];
  let html=`<h3>💧 ${T('sendOMV')}</h3><p class="muted">${esc(L(CONCEPTS.find(c=>c.id==='omv').text))}</p><div class="col">`;
  html+=`<button data-t="enzyme">🎁 ${T('omvEnzyme')}</button><button data-t="toxin">☠️ ${T('omvToxin')}</button><button data-t="dna">🧬 ${T('omvDNA')}</button>`;
  if(Rules.has(st,me,'ice')){html+=`<label>${L({es:'Gen a regalar (requiere ICE):',en:'Gene to gift (requires ICE):'})} <select id="omvGene">${P.genes.map(g=>`<option value="${g}">${esc(L(GBY[g].name))}</option>`).join('')}</select></label>`;}
  html+=`</div><p class="muted small">${L({es:`Alcance: ${tg.length} hexes (vecinos y río abajo).`,en:`Range: ${tg.length} hexes (neighbours and downstream).`})}</p>`;
  openModal(html);$$('#modal [data-t]').forEach(b=>b.onclick=()=>{const g=$('#omvGene')?$('#omvGene').value:null;closeModal();if(b.dataset.t==='dna'&&!tg.length){Rules.doOMV(me,st,i,i,'dna',map);refresh();return;}mode={kind:'omv',from:i,type:b.dataset.t,gene:g,targets:tg.concat(b.dataset.t==='dna'?[i]:[])};toast(L({es:'Elige el hex destino. Esc cancela.',en:'Pick the target hex. Esc cancels.'}),3000);});}
// ---------- c-di-GMP ----------
$('#cdgBtn').onclick=()=>{if(!st||st.over)return;const r=Rules.doCdg(st.human,st);if(r.ok){Audio_.sfx('click');toast(T('cdgSwitch'));}else toast(T(r.msg));refresh();};
// ---------- genes ----------
$('#btnGenes').onclick=()=>openGenes();
function openGenes(){const me=st.human,P=st.factions[me];const shown=GENES.filter(g=>g.show);
  let html=`<h3>🧬 ${L({es:'Poderes',en:'Powers'})} (${shown.filter(g=>Rules.has(st,me,g.id)).length}/${shown.length})</h3><p class="muted small">${L({es:'Cada poder es un gen real. Es más barato copiarlo de un vecino (conjugación) que inventarlo (mutación).',en:'Each power is a real gene. Copying it from a neighbour (conjugation) is cheaper than inventing it (mutation).'})}</p><div class="pgrid">`;
  for(const g of shown){const own=Rules.has(st,me,g.id);const r=Rules.geneRoutes(me,st,g.id,map)[0];const cost=Rules.geneCost(g.id,r.k,st,me);const can=!own&&P.res.energy>=cost.energy&&P.res.carbon>=cost.carbon&&P.actions>0;
    html+=`<div class="pcard ${own?'own':''}"><div class="pi">${g.icon}</div><b>${esc(L(g.short))}</b><div class="small muted">${esc(L(g.desc)).split('.')[0]}.</div>${own?`<span class="ok">✓</span>`:`<button data-g="${g.id}" ${can?'':'disabled'}>⚡${cost.energy} 🟢${cost.carbon}<br><small>${T(r.via)}${r.from?' · '+FBY[r.from].icon:''}</small></button>`}</div>`;}
  html+='</div>';openModal(html,true);$$('#modal [data-g]').forEach(b=>b.onclick=()=>{const r=Rules.doGene(me,st,b.dataset.g,map);if(r.ok){Audio_.sfx('gene');toast(`🧬 ${esc(L(GBY[b.dataset.g].short))} · ${T(r.via)}`);openGenes();refresh();}else toast(T(r.msg));});}
// ---------- diplomacy ----------
$('#btnDiplo').onclick=()=>openDiplo();
function openDiplo(){const me=st.human;let html=`<h3>🤝 ${T('diplomacy')}</h3><p class="muted small">${esc(L(CONCEPTS.find(c=>c.id==='syn').text))}</p>`;
  for(const F of FACTIONS){const o=F.id;if(o===me)continue;const P=st.factions[o];const r=Rules.rel(st,me,o);const al=Rules.isAllied(st,me,o),war=Rules.atWar(st,me,o);
    html+=`<div class="dip ${P.alive?'':'dead'}"><div class="dname" style="color:${F.color}">${esc(L(F.name))} <small>${esc(L(F.leader))} · ${esc(F.metab==='auto'?L({es:'autótrofo',en:'autotroph'}):F.metab==='hetero'?L({es:'heterótrofo',en:'heterotroph'}):L({es:'mixótrofo',en:'mixotroph'}))}${Rules.complementary(me,o)?' · '+L({es:'complementario',en:'complementary'}):''}</small></div>`;
    html+=`<div class="rel"><div class="bar"><i style="width:${50+r/2}%;background:${r>=0?'#3fbf8f':'#c8401a'}"></i></div> ${r} · ${al?'🤝 '+T('allied'):war?'⚔️ '+T('atWar'):T('neutral')} · 🗺 ${Rules.territory(st,o)} · 💪 ${Rules.strength(st,o).toFixed(0)}</div>`;
    if(P.alive)html+=`<div class="acts">${!al&&!war?`<button data-k="syntrophy" data-o="${o}">${T('syntrophy')}</button>`:''}${war?`<button data-k="peace" data-o="${o}">${T('peace')}</button>`:''}${!war&&!al?`<button data-k="war" data-o="${o}" class="danger">${T('war')}</button>`:''}<button data-k="gift" data-o="${o}">${T('gift')} ⚡3</button></div>`;
    html+=`<div class="fq small">“${esc(L(F.personality.quote))}”</div></div>`;}
  openModal(html,true);$$('#modal [data-k]').forEach(b=>b.onclick=()=>{const r=Rules.propose(st,me,b.dataset.o,b.dataset.k,map);if(!r.ok){toast(T(r.msg));return;}
    const F=FBY[b.dataset.o];if(b.dataset.k==='war'){Audio_.sfx('war');}else if(r.accepted){Audio_.sfx('diplo');toast(`${esc(L(F.leader))}: ${L({es:'“Acepto.”',en:'“Accepted.”'})}`);}else toast(`${esc(L(F.leader))}: ${L({es:'“Todavía no. Mejora nuestra relación.”',en:'“Not yet. Improve our relation.”'})}`);openDiplo();refresh();});}
// ---------- pedia ----------
$('#btnPedia').onclick=()=>openPedia('fac');
function openPedia(tab){const tabs=[['fac',{es:'Facciones',en:'Factions'}],['gen',{es:'Genes',en:'Genes'}],['site',{es:'Sitios',en:'Sites'}],['con',{es:'Conceptos',en:'Concepts'}],['ev',{es:'Eventos',en:'Events'}]];
  let html=`<h3>📖 ${T('pedia')}</h3><div class="tabs">${tabs.map(t=>`<button data-tab="${t[0]}" class="${t[0]===tab?'sel':''}">${esc(L(t[1]))}</button>`).join('')}</div><div class="pbody">`;
  if(tab==='fac')html+=FACTIONS.map(f=>`<div class="pe"><h4 style="color:${f.color}">${esc(L(f.name))} — <i>${esc(f.taxon)}</i></h4><div class="small muted">${esc(f.species)} · 👑 ${esc(L(f.leader))} · 🏠 ${f.home} · pH ${f.phOpt}±${f.phTol} · ${f.tOpt}±${f.tTol} °C</div><ul>${L(f.traits).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
  if(tab==='gen')html+=GENES.map(g=>`<div class="pe"><h4>${esc(L(g.name))}</h4><div class="small">${esc(L(g.desc))}</div></div>`).join('');
  if(tab==='site')html+=Object.keys(COPAHUE.sites).map(c=>{const s=COPAHUE.sites[c];const tx=COPAHUE.taxa[c];return `<div class="pe"><h4>${c} — ${esc(s.name)}</h4>${PHOTOS[c]?`<img class="photo" src="${PHOTOS[c]}">`:''}<div class="small">${Object.entries(s.v).map(([k,v])=>`${k} ${fmt(v)}`).join(' · ')}</div>${tx?`<div class="small muted">${T('metagenome')}: ${(tx.reads/1e6).toFixed(1)} M ${T('reads')}, ${T('shannon')} ${tx.shannon}, ${tx.mags.bins|0} MAGs. Top: ${tx.genus.slice(0,5).map(([g,p])=>`<i>${esc(g)}</i> ${p.toFixed(1)} %`).join(', ')}${tx.acidithio?'<br><i>Acidithiobacillus</i> spp.: '+Object.entries(tx.acidithio).filter(([k])=>k!=='Acidithiobacillus').sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${esc(k)} ${(v/1e6).toFixed(2)} M`).join(', '):''}</div>`:''}</div>`;}).join('');
  if(tab==='con')html+=CONCEPTS.map(c=>`<div class="pe"><h4>${esc(L(c.name))}</h4><div class="small">${esc(L(c.text))}</div></div>`).join('');
  if(tab==='ev')html+=EVENTS.map(e=>`<div class="pe"><h4>${esc(L(e.name))}</h4><div class="small">${esc(L(e.desc))}</div></div>`).join('');
  html+=`</div><div class="small muted">${L({es:'Fuentes: campañas Copahue 2019–2020 (copahue-v8/data), Arisan et al. 2024 Front. Microbiol. 15:1360268, Moya‑Beltrán et al. 2021 ISME J 15:3221.',en:'Sources: Copahue campaigns 2019–2020 (copahue-v8/data), Arisan et al. 2024 Front. Microbiol. 15:1360268, Moya‑Beltrán et al. 2021 ISME J 15:3221.'})}</div>`;
  openModal(html,true);$$('#modal [data-tab]').forEach(b=>b.onclick=()=>openPedia(b.dataset.tab));}
// ---------- menu ----------
$('#btnMenu').onclick=()=>openMenu();$('#btnHow').onclick=()=>openTutorial(true);$('#btnPause').onclick=()=>{paused=!paused;$('#btnPause').textContent=paused?'▶ '+T('resume'):'⏸ '+T('pause');toast(paused?T('pause'):T('resume'));};
function openMenu(){let html=`<h3>☰ ${T('menu')} <small class="muted">${VERSION}</small></h3><div class="col">`;
  html+=`<button id="mSave">💾 ${T('save')}</button><button id="mExport">⬇️ ${T('save')} (.json)</button><button id="mLang">🌐 ${T('lang')}</button><button id="mSound">${Audio_.on?'🔊':'🔇'} ${T('sound')}</button><button id="mMusic">${Audio_.musicOn?'🎵':'🎵✖'} ${T('music')}</button><button id="mHelp">❓ ${T('help')}</button><button id="mQuit" class="danger">⏏ ${T('quit')}</button></div>`;
  openModal(html);$('#mSave').onclick=()=>{Save.save(user,st.mode,st);toast('💾 '+T('save')+' ✓');};$('#mExport').onclick=()=>{Save.save(user,st.mode,st);Save.exportJSON(user,st.mode);};
  $('#mLang').onclick=()=>{setLang(LANG==='es'?'en':'es');applyLang();closeModal();refresh();};$('#mSound').onclick=()=>{Audio_.toggleSound();openMenu();};$('#mMusic').onclick=()=>{Audio_.toggleMusic();openMenu();};
  $('#mHelp').onclick=()=>openHelp();$('#mQuit').onclick=()=>{Save.save(user,st.mode,st);closeModal();showTitle();};}
function openHelp(){openModal(`<h3>❓ ${T('help')}</h3>${L({es:`<ul class="help"><li>🎯 <b>Gana</b> dominando el río, juntando poderes o haciendo alianzas. Al final gana el mejor puntaje.</li><li>🧫 <b>Colonizar</b>: elige un hex tuyo con 3+ 👥 y luego un hex vecino. Río abajo es fácil; el pH y la temperatura deciden tu aptitud.</li><li>🧱 <b>Biofilm</b>: muralla. Solo en modo 🛡 Defender.</li><li>💧 <b>Vesículas</b>: regalo 🎁, ataque ☠️ o escudo 🧬.</li><li>🧬 <b>Poderes</b> (G) y 🤝 <b>Alianzas</b> (D). 3 acciones por turno, Enter termina el turno.</li></ul>`,en:`<ul class="help"><li>🎯 <b>Win</b> by dominating the river, collecting powers or making alliances. Best score wins at the end.</li><li>🧫 <b>Colonize</b>: pick your hex with 3+ 👥, then a neighbour. Downstream is easy; pH and temperature set your fitness.</li><li>🧱 <b>Biofilm</b>: a wall. Only in 🛡 Defend mode.</li><li>💧 <b>Vesicles</b>: gift 🎁, attack ☠️ or shield 🧬.</li><li>🧬 <b>Powers</b> (G) and 🤝 <b>Alliances</b> (D). 3 actions per turn, Enter ends the turn.</li></ul>`})}`);}
// ---------- modal ----------
function openModal(html,wide){const m=$('#modal');m.querySelector('.box').innerHTML=html+`<button class="close" id="mClose">✕</button>`;m.classList.add('open');m.querySelector('.box').classList.toggle('wide',!!wide);$('#mClose').onclick=closeModal;}
function closeModal(){$('#modal').classList.remove('open');}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
// ---------- turn ----------
$('#btnEnd').onclick=()=>endTurn();
function endTurn(){if(!st||st.over)return;if(autoEndTimer){clearTimeout(autoEndTimer);autoEndTimer=null;}cancelMode();Audio_.sfx('turn');pendingMsgs=[];
  const say=(f,kind,d)=>pendingMsgs.push({f,kind,d});
  const logStart=st.log.length;
  for(const F of FACTIONS){if(F.id===st.human)continue;AI.takeTurn(F.id,st,map,say);}
  st.markers=[];for(const e of st.log.slice(logStart)){const d=e.data;if(!d||!d.f||d.f===st.human)continue;const F=FBY[d.f];let i=null,txt='';
    if(e.kind==='colonized'){i=d.to;txt=L({es:'Colonizado por',en:'Colonized by'});}else if(e.kind==='won'){i=d.to;txt=L({es:'Conquistado por',en:'Conquered by'});}else if(e.kind==='prepare'){i=d.i;txt=L({es:'Preparado por',en:'Prepared by'});}else if(e.kind==='biofilm'){i=d.i;txt=L({es:'Biofilm de',en:'Biofilm by'});}else if(e.kind==='omvToxin'){i=d.to;txt=L({es:'Toxinas de',en:'Toxins from'});}else if(e.kind==='lost'){i=d.to;txt=L({es:'Ataque fallido de',en:'Failed attack by'});}
    if(i!==null&&!st.markers.some(m=>m.i===i))st.markers.push({i,text:`${txt} ${F.icon} ${L(F.name)}`,color:F.color,ttl:9});}
  const ev=Rules.worldTurn(st,map);
  Save.save(user,st.mode,st);timerLeft=st.timer||0;refresh();
  if(ev){Audio_.sfx(ev.id==='eruption'?'eruption':'event');const m=st.activeMods[st.activeMods.length-1];const hx=m&&m.data.hex!==undefined?m.data.hex:null;
    openModal(`<h3>🌋 ${esc(L(ev.name))}</h3>${hx!==null&&COPAHUE.hexes[hx].site&&PHOTOS[COPAHUE.hexes[hx].site]?`<img class="photo" src="${PHOTOS[COPAHUE.hexes[hx].site]}">`:''}<p>${esc(L(ev.desc))}</p>${hx!==null?`<p class="small muted">→ ${hexName(hx)}</p>`:''}`);if(hx!==null)selectHex(hx);}
  showMsgs();tips();if(st.over)setTimeout(showGameOver,ev?1200:200);}
function showMsgs(){if(!pendingMsgs.length)return;const me=st.human;const box=$('#msgs');box.innerHTML='';
  pendingMsgs.slice(0,4).forEach(m=>{const F=FBY[m.f];let text='',btns='';
    if(m.kind==='proposeAlly'){text=L({es:`“${L(F.personality.quote)}” — ${L(F.leader)} te propone <b>sintrofia</b>.`,en:`“${L(F.personality.quote)}” — ${L(F.leader)} proposes <b>syntrophy</b>.`});btns=`<button data-a="ally">${L({es:'Aceptar',en:'Accept'})}</button><button data-a="no">${L({es:'Rechazar',en:'Decline'})}</button>`;}
    else if(m.kind==='proposePeace'){text=L({es:`${L(F.leader)} pide la <b>paz</b>.`,en:`${L(F.leader)} asks for <b>peace</b>.`});btns=`<button data-a="peace">${L({es:'Aceptar',en:'Accept'})}</button><button data-a="no">${L({es:'Rechazar',en:'Decline'})}</button>`;}
    else if(m.kind==='war'){text=L({es:`⚔️ ${L(F.leader)}: “${L(F.personality.quote)}” — ¡te declaró la <b>guerra</b>!`,en:`⚔️ ${L(F.leader)}: “${L(F.personality.quote)}” — declared <b>war</b> on you!`});Audio_.sfx('war');}
    else if(m.kind==='toxin'&&m.d.d===me){text=L({es:`☠️ ${L(F.name)} te lanzó vesículas tóxicas en ${hexName(m.d.to)}.`,en:`☠️ ${L(F.name)} fired toxic vesicles at you in ${hexName(m.d.to)}.`});}
    else if(m.kind==='colonize'){text=L({es:`${L(F.leader)}: “${L(F.personality.quote)}” (colonizó ${hexName(m.d.to)})`,en:`${L(F.leader)}: “${L(F.personality.quote)}” (colonized ${hexName(m.d.to)})`});}
    else if(m.kind==='gene'){text=L({es:`🧬 ${L(F.name)} adquirió <i>${L(GBY[m.d.g].name)}</i>.`,en:`🧬 ${L(F.name)} acquired <i>${L(GBY[m.d.g].name)}</i>.`});}
    else return;
    const d=document.createElement('div');d.className='msg';d.style.borderColor=F.color;d.innerHTML=`<span class="dot" style="background:${F.color}"></span>${text} ${btns}`;box.appendChild(d);
    d.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const k=Rules.KEY(me,m.f);if(b.dataset.a==='ally'){st.alliances[k]=st.turn;delete st.wars[k];Rules.addRel(st,me,m.f,20);Rules.log(st,'ally',{f:m.f,d:me});Audio_.sfx('diplo');}if(b.dataset.a==='peace'){delete st.wars[k];st.relations[k]=Math.max(st.relations[k],-20);Rules.log(st,'peace',{f:m.f,d:me});Audio_.sfx('diplo');}if(b.dataset.a==='no')Rules.addRel(st,me,m.f,-5);d.remove();refresh();});
    setTimeout(()=>{if(d.parentNode&&!btns)d.remove();},9000);});}
function tips(){const me=st.human,P=st.factions[me],F=FBY[me];const t=[];
  if(st.easy&&st.turn<=4)t.push([L({es:'Modo Aprender: los rivales no atacan. Prueba a colonizar los hexes con +, y luego abre un hex tuyo para ver Biofilm, Vesículas y Preparar agua.',en:'Learn mode: rivals do not attack. Try colonizing the + hexes, then open one of your hexes to see Biofilm, Vesicles and Prepare water.'}),L({es:'Los hexes de agua ácida y caliente le gustan a unas comunidades y a otras no: mira la barra de Aptitud antes de ir.',en:'Hot acid water suits some communities and not others: check the Fitness bar before you go.'}),L({es:'Cada 4–5 turnos pasa algo en el volcán (erupción, deshielo, fagos…). ¡Lee el aviso!',en:'Every 4–5 turns something happens at the volcano (eruption, melt, phages…). Read the notice!'})][st.turn-2]||'');
  if(P.res.energy<4)t.push(L({es:'Energía baja: coloniza hexes con azufre o hierro (vertientes, cráter) o, si eres heterótrofo, junto a autótrofos.',en:'Low energy: colonize sulfur/iron hexes (springs, crater) or, if heterotroph, next to autotrophs.'}));
  if(P.cdg==='high'&&Rules.territory(st,me)<4)t.push(L({es:'Con pocos hexes conviene c-di-GMP BAJO para expandirte; súbelo cuando quieras amurallar con biofilm.',en:'With few hexes, LOW c-di-GMP helps you expand; raise it when you want to wall up with biofilm.'}));
  if(F.auxotroph&&!Object.keys(st.alliances).some(k=>k.indexOf(me)>=0))t.push(L({es:'I. copahuensis no fabrica serina ni histidina: una sintrofia con los Recicladores o la República te dará más carbono.',en:'I. copahuensis cannot make serine or histidine: syntrophy with the Recyclers or the Republic gives more carbon.'}));
  if(st.turn===3)t.push(L({es:'Cada 4–5 turnos pasa un evento volcánico o climático. Las endosporas y CRISPR protegen.',en:'Every 4–5 turns a volcanic or weather event hits. Endospores and CRISPR protect you.'}));
  if(P.genes.length<6&&st.turn>5)t.push(L({es:'Mira el panel de Genes (G): la conjugación con un vecino es la mitad de barata que la mutación.',en:'Check the Genes panel (G): conjugation with a neighbour costs half of mutation.'}));
  if(Object.keys(st.wars).some(k=>k.indexOf(me)>=0))t.push(L({es:'Estás en guerra: biofilm y EPS suben la defensa; bacteriocinas suben el ataque.',en:'You are at war: biofilm and EPS raise defence; bacteriocins raise attack.'}));
  for(const x of t){if(!tipShown[x]){tipShown[x]=1;adviser(x);return;}}}
function showGameOver(){const w=st.winner;if(!w)return;const me=st.human;const sc=FACTIONS.map(F=>[F.id,Rules.score(st,F.id,map)]).sort((a,b)=>b[1]-a[1]);const won=w.f===me;Audio_.sfx(won?'fanfare':'fail');
  let html=`<h3>${won?'🏆 '+T('victory'):'🏁 '+T('gameOver')}</h3><p>${fname(w.f)} — <b>${T(w.kind==='score'?'score':w.kind)}</b></p><table class="sc">${sc.map(([f,s],i)=>`<tr><td>${i+1}</td><td>${fname(f)}</td><td>${Rules.territory(st,f)} 🗺</td><td>${st.factions[f].genes.length} 🧬</td><td><b>${s}</b></td></tr>`).join('')}</table>`;
  html+=`<h4>${T('learned')}</h4><div class="cmp"><div><b>${T('yourMap')}</b></div><div><b>${T('realMap')}</b></div>`;
  for(const code in COPAHUE.taxa){const i=COPAHUE.siteHex[code];if(i===undefined)continue;const s=st.hexes[i];const top=COPAHUE.taxa[code].genus[0];html+=`<div>${code}: ${s.owner?fname(s.owner):'<i>—</i>'}</div><div>${code}: <i>${esc(top[0])}</i> ${top[1].toFixed(0)} %</div>`;}
  html+=`</div><p class="small muted">${L({es:'En el río real, Acidithiobacillus domina las aguas ácidas calientes (VA2, RAS1, CC, RA_RJ), Acidiphilium y Ferrovum el lago y el Agrio inferior, y Limnohabitans las aguas neutras (LN, RJ). ¿Se parece tu mapa?',en:'In the real river, Acidithiobacillus dominates hot acid waters (VA2, RAS1, CC, RA_RJ), Acidiphilium and Ferrovum the lake and lower Agrio, and Limnohabitans the neutral waters (LN, RJ). Does your map look alike?'})}</p><button id="goTitle">${T('menu')}</button>`;
  openModal(html,true);$('#goTitle').onclick=()=>{closeModal();showTitle();};}
// ---------- keys ----------
function onKey(e){if(!st||$('#title').classList.contains('open'))return;const tag=document.activeElement&&document.activeElement.tagName;if(tag==='INPUT'||tag==='SELECT')return;
  if(e.key==='Escape'){if(mode)cancelMode();else if($('#modal').classList.contains('open'))closeModal();else openMenu();}
  if(e.key==='Enter'){if($('#modal').classList.contains('open'))closeModal();else openTutorial(true);}
  if(e.key==='g'||e.key==='G')openGenes();if(e.key==='d'||e.key==='D')openDiplo();if(e.key==='p'||e.key==='P')openPedia('fac');if(e.key==='h'||e.key==='H')openHelp();if(e.key==='c'||e.key==='C')$('#cdgBtn').click();}
// ---------- lang ----------
function applyLang(){$$('[data-i]').forEach(el=>el.textContent=T(el.dataset.i));document.documentElement.lang=LANG;$('#langBtn').textContent=T('lang');if(!st)renderUsers();}
$('#langBtn').onclick=()=>{setLang(LANG==='es'?'en':'es');applyLang();};
window.COLON={get st(){return st;},get map(){return map;},endTurn,startNew,refresh};
document.addEventListener('DOMContentLoaded',boot);
})();
