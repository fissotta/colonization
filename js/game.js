// COLONIZATION — interfaz, flujo de turnos, modos de juego
'use strict';
(function(){
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let map,st=null,mode=null,lastT=0,timerLeft=0,paused=false,pendingMsgs=[],user='',tipShown={};
const canvas=$('#map');
function resize(){const wrap=$('#mapwrap');canvas.width=wrap.clientWidth*devicePixelRatio;canvas.height=wrap.clientHeight*devicePixelRatio;canvas.style.width=wrap.clientWidth+'px';canvas.style.height=wrap.clientHeight+'px';if(map)map.fit();}
window.addEventListener('resize',resize);
// ---------- boot ----------
function boot(){map=new HexMap.HexMapRenderer(COPAHUE,canvas);resize();applyLang();showTitle();requestAnimationFrame(loop);
  canvas.addEventListener('mousemove',e=>{const [x,y]=pt(e);if(drag.on){map.ox+=(e.clientX-drag.x)*devicePixelRatio;map.oy+=(e.clientY-drag.y)*devicePixelRatio;drag.x=e.clientX;drag.y=e.clientY;drag.moved=true;return;}map.hover=map.hexAt(x,y);if(map.hover>=0&&!st?.hexes[map.hover])map.hover=-1;});
  canvas.addEventListener('mousedown',e=>{drag.on=true;drag.x=e.clientX;drag.y=e.clientY;drag.moved=false;});
  window.addEventListener('mouseup',e=>{if(drag.on&&!drag.moved&&e.target===canvas){const [x,y]=pt(e);clickHex(map.hexAt(x,y));}drag.on=false;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=pt(e);const z0=map.zoom;map.zoom=HexMap.clamp(map.zoom*(e.deltaY<0?1.12:.89),.6,3.5);const k=map.zoom/z0;map.ox=x-(x-map.ox)*k;map.oy=y-(y-map.oy)*k;},{passive:false});
  canvas.addEventListener('mouseleave',()=>{map.hover=-1;});
  document.addEventListener('keydown',onKey);
  document.body.addEventListener('pointerdown',()=>{Audio_.resume();},{once:true});
}
const drag={on:false,x:0,y:0,moved:false};
function pt(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*devicePixelRatio,(e.clientY-r.top)*devicePixelRatio];}
function loop(t){const dt=Math.min(.05,(t-lastT)/1000||0);lastT=t;if(st&&!paused&&!st.over&&st.mode==='quick'&&timerLeft>0&&!$('#modal').classList.contains('open')){timerLeft-=dt;$('#timer').textContent=Math.ceil(timerLeft)+'s';$('#timer').classList.toggle('warn',timerLeft<15);if(timerLeft<=0){toast(T('autoEnd'));endTurn();}}
  if(st)st.targets=mode?mode.targets:null;map.draw(st,dt);requestAnimationFrame(loop);}
// ---------- title ----------
function showTitle(){$('#title').classList.add('open');$('#game').classList.remove('open');st=null;renderUsers();}
function renderUsers(){user=user||Save.lastUser();const us=Save.users();const box=$('#users');box.innerHTML='';us.forEach(u=>{const b=document.createElement('button');b.className='chip'+(u===user?' sel':'');b.textContent=u;b.onclick=()=>{user=u;Save.addUser(u);renderUsers();};box.appendChild(b);});
  const inp=document.createElement('input');inp.placeholder=T('newUser');inp.maxLength=24;inp.onkeydown=e=>{if(e.key==='Enter'){const n=Save.addUser(inp.value);if(n){user=n;renderUsers();}}};box.appendChild(inp);
  const saves=user?Save.list(user):[];const sv=$('#saves');sv.innerHTML='';saves.forEach(s=>{if(!s.t)return;const d=new Date(s.t);const b=document.createElement('button');b.className='big';b.innerHTML=`<b>${T('continue')} · ${s.mode==='quick'?T('quick'):T('campaign')}</b><small>${esc(L(FBY[s.faction].name))} · ${T('turn')} ${s.turn} · ${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0,5)}${s.over?' · '+T('gameOver'):''}</small>`;b.onclick=()=>{const l=Save.load(user,s.mode);if(l)startFromState(l.state);};sv.appendChild(b);});
  $('#btnQuick').disabled=$('#btnCampaign').disabled=!user;$('#whoPlays').textContent=user?user:'—';}
$('#btnQuick').onclick=()=>chooseFaction('quick');$('#btnCampaign').onclick=()=>chooseFaction('campaign');
function chooseFaction(m){const box=$('#factions');box.innerHTML='';FACTIONS.forEach(f=>{const c=document.createElement('div');c.className='fcard';c.style.borderColor=f.color;c.innerHTML=`<div class="fname" style="color:${f.color}">${esc(L(f.name))}</div><div class="ftax">${esc(f.taxon)}</div><div class="fsp">${esc(f.species)}</div><div class="flead">👑 ${esc(L(f.leader))} · 🏠 ${f.home}</div><ul>${L(f.traits).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><div class="fq">“${esc(L(f.personality.quote))}”</div>`;c.onclick=()=>{Audio_.resume();Audio_.sfx('click');startNew(m,f.id);};box.appendChild(c);});$('#pick').classList.add('open');$('#pickMode').textContent=m==='quick'?T('quick'):T('campaign');}
$('#pickClose').onclick=()=>$('#pick').classList.remove('open');
function startNew(m,fid){$('#pick').classList.remove('open');const s=Rules.newState(map,{mode:m,faction:fid,user});Rules.effective(s,map);startFromState(s);const F=FBY[fid];adviser(L({es:`Bienvenida, ${esc(L(F.leader))}. Tu capital es ${F.home}. Selecciona un hex tuyo con población ≥ 3 y pulsa Colonizar.`,en:`Welcome, ${esc(L(F.leader))}. Your capital is ${F.home}. Select one of your hexes with population ≥ 3 and press Colonize.`}));}
function startFromState(s){st=s;mode=null;if(!$('#adviser').innerHTML)$('#adviser').style.display='none';paused=false;$('#title').classList.remove('open');$('#game').classList.add('open');resize();map.sel=-1;timerLeft=st.timer||0;Audio_.resume();Audio_.setMusic({faction:st.human,era:st.era||0,war:humanAtWar()});refresh();selectHex(COPAHUE.siteHex[FBY[st.human].home]);if(st.over)showGameOver();}
// ---------- HUD ----------
function refresh(){if(!st)return;const P=st.factions[st.human],F=FBY[st.human];
  $('#hudFaction').innerHTML=`<span class="dot" style="background:${F.color}"></span>${esc(L(F.name))} · <small>${esc(user)}</small>`;
  $('#hudTurn').textContent=`${T('turn')} ${Math.min(st.turn,st.maxTurns)}/${st.maxTurns}`;$('#hudEra').textContent=T('eraNames')[st.era||0];
  $('#hudRes').innerHTML=`<span title="${T('energy')}">⚡ ${P.res.energy.toFixed(0)}</span><span title="${T('carbon')}">🟢 ${P.res.carbon.toFixed(0)}</span><span title="${T('nutrients')}">🧪 ${P.res.nutrients.toFixed(0)}</span><span title="${T('actions')}">🎯 ${P.actions}</span><span>🗺 ${Rules.territory(st,st.human)}/${map.playable.length}</span>`;
  $('#cdgBtn').innerHTML=`<b>${T('cdg')}</b> ${P.cdg==='high'?T('cdgHigh'):T('cdgLow')}${P.cdgPending?' ⏳':''}`;$('#cdgBtn').className='cdg '+P.cdg;
  $('#timer').style.display=st.mode==='quick'?'':'none';
  renderLog();if(map.sel>=0)renderHex(map.sel);
  const era=Rules?st.era:0;Audio_.setMusic({era:st.era||0,war:humanAtWar()});
  $('#btnPause').style.display=st.mode==='campaign'?'':'none';}
function humanAtWar(){return Object.keys(st.wars).some(k=>k.split('|').indexOf(st.human)>=0);}
function renderLog(){const box=$('#log');const items=st.log.slice(-14).reverse();box.innerHTML=items.map(e=>`<div class="le">${logText(e)}</div>`).join('');}
function fname(f){const F=FBY[f];return `<b style="color:${F.color}">${esc(L(F.name))}</b>`;}
function hexName(i){const h=COPAHUE.hexes[i];return h.site?`${h.site} (${esc(COPAHUE.sites[h.site]?L({es:COPAHUE.sites[h.site].name,en:COPAHUE.sites[h.site].name}):h.site)})`:esc(h.river||'')+` [${h.c},${h.r}]`;}
function logText(e){const d=e.data;const t=`<small>T${e.turn}</small> `;switch(e.kind){
  case 'colonized':return t+L({es:`${fname(d.f)} colonizó ${hexName(d.to)}.`,en:`${fname(d.f)} colonized ${hexName(d.to)}.`});
  case 'failed':return t+L({es:`${fname(d.f)} fracasó al colonizar ${hexName(d.to)}.`,en:`${fname(d.f)} failed to colonize ${hexName(d.to)}.`});
  case 'won':return t+L({es:`⚔️ ${fname(d.f)} desplazó a ${fname(d.d)} de ${hexName(d.to)}.`,en:`⚔️ ${fname(d.f)} displaced ${fname(d.d)} from ${hexName(d.to)}.`});
  case 'lost':return t+L({es:`🛡 ${fname(d.d)} resistió a ${fname(d.f)} en ${hexName(d.to)}.`,en:`🛡 ${fname(d.d)} resisted ${fname(d.f)} at ${hexName(d.to)}.`});
  case 'biofilm':return t+L({es:`${fname(d.f)}: biofilm nivel ${d.lvl} en ${hexName(d.i)}.`,en:`${fname(d.f)}: biofilm level ${d.lvl} at ${hexName(d.i)}.`});
  case 'gene':return t+L({es:`🧬 ${fname(d.f)} adquirió <i>${esc(L(GBY[d.g].name))}</i> por ${T(d.via)}.`,en:`🧬 ${fname(d.f)} acquired <i>${esc(L(GBY[d.g].name))}</i> by ${T(d.via)}.`});
  case 'omvGift':return t+L({es:`🎁 ${fname(d.f)} envió vesículas con enzimas a ${fname(d.d)}.`,en:`🎁 ${fname(d.f)} sent enzyme vesicles to ${fname(d.d)}.`});
  case 'omvToxin':return t+L({es:`☠️ ${fname(d.f)} lanzó vesículas tóxicas contra ${fname(d.d)} en ${hexName(d.to)}.`,en:`☠️ ${fname(d.f)} fired toxic vesicles at ${fname(d.d)} in ${hexName(d.to)}.`});
  case 'omvShield':return t+L({es:`🛡 ${fname(d.f)} liberó vesículas señuelo en ${hexName(d.to)}: inmune a fagos.`,en:`🛡 ${fname(d.f)} released decoy vesicles at ${hexName(d.to)}: phage-immune.`});
  case 'omvGene':return t+L({es:`🧬 ${fname(d.f)} regaló el gen <i>${esc(L(GBY[d.gene].name))}</i> a ${fname(d.d)}.`,en:`🧬 ${fname(d.f)} gifted gene <i>${esc(L(GBY[d.gene].name))}</i> to ${fname(d.d)}.`});
  case 'omvDNA':return t+L({es:`🧬 ${fname(d.f)} dejó ADN de <i>${esc(L(GBY[d.gene].name))}</i> en territorio de ${fname(d.d)}.`,en:`🧬 ${fname(d.f)} left DNA of <i>${esc(L(GBY[d.gene].name))}</i> in ${fname(d.d)} territory.`});
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
  if(mode){if(mode.targets.indexOf(i)>=0){execTarget(i);}else{cancelMode();selectHex(i);}return;}
  selectHex(i);}
function selectHex(i){map.sel=i;renderHex(i);}
function renderHex(i){const h=COPAHUE.hexes[i],s=st.hexes[i];if(!s){$('#hexpanel').innerHTML=`<div class="muted">${T('selectHex')}</div>`;return;}
  const me=st.human;const F=FBY[me];const fit=Rules.fitness(me,st,i,map);const e=s.eff;const site=h.site?COPAHUE.sites[h.site]:null;
  let html=`<div class="hname">${site?esc(site.name):esc(h.river||'')}${h.site?` <span class="code">${h.site}</span>`:''}</div><div class="htype">${typeName(h)} · ${h.el} m</div>`;
  if(h.site&&PHOTOS[h.site])html+=`<img class="photo" src="${PHOTOS[h.site]}" alt="${h.site}">`;
  html+=`<div class="chem"><span>${T('ph')} <b>${e.ph.toFixed(2)}</b></span><span>${T('temp')} <b>${e.T.toFixed(1)} °C</b></span><span>${T('fe')} <b>${fmt(e.fe)} ppm</b></span><span>${T('so4')} <b>${fmt(e.so4)} ppm</b></span><span>${T('o2')} <b>${fmt(e.o2)} %</b></span><span>${T('ec')} <b>${fmt(e.ec)} µS/cm</b></span></div>`;
  if(site&&site.years)html+=`<div class="muted small">${T('site')}: ${site.ids.join(', ')} · ${site.years.join('/')}</div>`;
  const own=s.owner?`${fname(s.owner)}${s.owner===me?' ('+T('yours')+')':''}`:`<i>${T('empty')}</i>`;
  html+=`<div class="own">${T('owner')}: ${own}<br>${T('pop')}: <b>${s.pop.toFixed(1)}</b> / ${Rules.capacity(st,i,map).toFixed(0)} · ${T('biofilmLvl')[s.biofilm]}${s.shield?' · 🛡'+s.shield:''}${s.eDNA?` · 🧬 <i>${esc(L(GBY[s.eDNA.gene].name))}</i>`:''}</div>`;
  html+=`<div class="fit">${T('fitness')}: <div class="bar"><i style="width:${(fit*100)|0}%;background:${F.color}"></i></div> ${(fit*100)|0} %</div>`;
  if(s.owner){const y=Rules.yields(s.owner,st,i,map);html+=`<div class="muted small">+⚡${y.energy.toFixed(1)} +🟢${y.carbon.toFixed(1)} +🧪${y.nutrients.toFixed(1)} / ${T('turn').toLowerCase()}</div>`;}
  // actions
  const P=st.factions[me];
  if(s.owner===me&&!st.over){html+=`<div class="acts">`;
    html+=`<button ${s.pop<3?'disabled':''} data-act="colonize">🧫 ${T('colonize')} / ${T('attack')} <small>⚡3</small></button>`;
    const cb=Rules.canBiofilm(me,st,i);html+=`<button ${cb!=='ok'?'disabled':''} data-act="biofilm" title="${cb}">🧱 ${T('biofilm')} ${s.biofilm}→${Math.min(3,s.biofilm+1)} <small>🟢${Rules.biofilmCost(me,st,i)}${cb==='cdg'?' · c-di-GMP↑':cb==='pop'?' · pop':cb==='max'?' · max':''}</small></button>`;
    html+=`<button data-act="omv">💧 ${T('omv')} <small>🟢3</small></button></div>`;}
  // taxa
  if(h.site&&COPAHUE.taxa[h.site]){const tx=COPAHUE.taxa[h.site];html+=`<div class="taxa"><div class="muted small">${T('metagenome')} ${h.site}: ${(tx.reads/1e6).toFixed(1)} M ${T('reads')} · ${T('shannon')} ${tx.shannon} · ${T('mags')} ${tx.mags.bins|0} (HQ ${tx.mags.HQ|0})</div>`+tx.genus.slice(0,6).map(([g,p])=>`<div class="tx"><span>${esc(g)}</span><div class="bar"><i style="width:${Math.min(100,p*2)|0}%;background:${genusColor(g)}"></i></div><small>${p.toFixed(1)} %</small></div>`).join('')+`</div>`;}
  $('#hexpanel').innerHTML=html;
  $$('#hexpanel [data-act]').forEach(b=>b.onclick=()=>hexAction(b.dataset.act,i));}
function fmt(v){return v===undefined||v===null?'–':(v>=100?v.toFixed(0):v>=10?v.toFixed(1):v.toFixed(2));}
function typeName(h){const m={river:{es:'Río',en:'River'},lake:{es:'Lago',en:'Lake'},crater:{es:'Laguna del cráter',en:'Crater lake'},spring:{es:'Vertiente ácida caliente',en:'Hot acid spring'},falls:{es:'Cascada / salto',en:'Waterfall'},hot:{es:'Terma neutra',en:'Neutral hot spring'},pond:{es:'Laguna',en:'Pond'},fumarole:{es:'Solfatara',en:'Solfatara'},land:{es:'Tierra',en:'Land'}};return L(m[h.t]||m.land);}
function genusColor(g){const m={Acidithiobacillus:'#f2c230',Leptospirillum:'#c8401a',Ferroplasma:'#c8401a',Sulfobacillus:'#b56cf0',Thiomonas:'#b56cf0',Acidiphilium:'#3fbf8f',Acidocella:'#3fbf8f',Ferrovum:'#8a6a2a',Limnohabitans:'#3a8ef0',Polynucleobacter:'#3a8ef0',Flavobacterium:'#3a8ef0'};return m[g]||'#999';}
function hexAction(act,i){const me=st.human;
  if(act==='colonize'){const tg=Rules.colonizeTargets(me,st,i,map);if(!tg.length){toast(st.factions[me].cdg==='high'?L({es:'Con c-di-GMP alto solo colonizas río abajo adyacente.',en:'With high c-di-GMP you only colonize adjacent downstream.'}):T('tooFar'));return;}mode={kind:'colonize',from:i,targets:tg};toast(L({es:'Elige el hex destino (brillante). Esc cancela.',en:'Pick a target hex (glowing). Esc cancels.'}),4000);}
  if(act==='biofilm'){const r=Rules.doBiofilm(me,st,i);if(r.ok){Audio_.sfx('biofilm');map.spawn(i,'bio',10);}else toast(T(r.msg));refresh();}
  if(act==='omv'){openOMV(i);}}
function execTarget(j){const me=st.human;
  if(mode.kind==='colonize'){const from=mode.from;const wasOwned=st.hexes[j].owner;const p=wasOwned&&wasOwned!==me?Rules.combat(me,st,from,j,map):Rules.colonizeOdds(me,st,from,j,map);const r=Rules.doColonize(me,st,from,j,map);
    if(!r.ok){toast(T(r.msg));cancelMode();return;}
    if(wasOwned){Audio_.sfx('battle');map.spawn(j,'battle',12);toast((r.won?'⚔️ '+T('won'):'🛡 '+T('lost'))+` (${(p*100)|0} %)`);}
    else{if(r.won){Audio_.sfx('colonize');map.spawn(j,'colonize',10);toast('🧫 '+T('success')+` (${(p*100)|0} %)`);}else{Audio_.sfx('fail');toast(T('fail')+` (${(p*100)|0} %)`);}}
    cancelMode();selectHex(j);refresh();return;}
  if(mode.kind==='omv'){const r=Rules.doOMV(me,st,mode.from,j,mode.type,map,mode.gene);if(!r.ok)toast(T(r.msg));else{Audio_.sfx('omv');map.spawn(j,mode.type==='toxin'?'toxin':mode.type==='dna'?'dna':'gift',10);}cancelMode();refresh();}}
function cancelMode(){mode=null;}
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
function openGenes(){const me=st.human,P=st.factions[me];const cats={energy:{es:'Energía',en:'Energy'},carbon:{es:'Carbono y nutrientes',en:'Carbon & nutrients'},tolerance:{es:'Tolerancia',en:'Tolerance'},defense:{es:'Defensa',en:'Defence'},mobility:{es:'Movilidad',en:'Mobility'},social:{es:'Social / genética móvil',en:'Social / mobile genetics'}};
  let html=`<h3>🧬 ${T('genes')} — ${L({es:'pangenoma abierto',en:'open pangenome'})} (${P.genes.length}/${GENES.length})</h3><p class="muted small">${esc(L(CONCEPTS.find(c=>c.id==='hgt').text))}</p><div class="genes">`;
  for(const c in cats){html+=`<h4>${esc(L(cats[c]))}</h4>`;for(const g of GENES.filter(g=>g.cat===c)){const own=Rules.has(st,me,g.id);const r=Rules.geneRoutes(me,st,g.id,map)[0];const cost=Rules.geneCost(g.id,r.k,st,me);const can=!own&&P.res.energy>=cost.energy&&P.res.carbon>=cost.carbon&&P.actions>0;
      html+=`<div class="gene ${own?'own':''}"><div><b>${esc(L(g.name))}</b><div class="small muted">${esc(L(g.desc))}</div></div><div class="gbuy">${own?`<span class="ok">✓ ${T('owned')}</span>`:`<button data-g="${g.id}" ${can?'':'disabled'}>${T('acquire')}<br><small>⚡${cost.energy} 🟢${cost.carbon} · ${T('via')} ${T(r.via)}${r.from?' ('+esc(L(FBY[r.from].name))+')':''}</small></button>`}</div></div>`;}}
  html+='</div>';openModal(html,true);$$('#modal [data-g]').forEach(b=>b.onclick=()=>{const r=Rules.doGene(me,st,b.dataset.g,map);if(r.ok){Audio_.sfx('gene');toast(`🧬 ${esc(L(GBY[b.dataset.g].name))} · ${T(r.via)}`);openGenes();refresh();}else toast(T(r.msg));});}
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
$('#btnMenu').onclick=()=>openMenu();$('#btnPause').onclick=()=>{paused=!paused;$('#btnPause').textContent=paused?'▶ '+T('resume'):'⏸ '+T('pause');toast(paused?T('pause'):T('resume'));};
function openMenu(){let html=`<h3>☰ ${T('menu')}</h3><div class="col">`;
  html+=`<button id="mSave">💾 ${T('save')}</button><button id="mExport">⬇️ ${T('save')} (.json)</button><button id="mLang">🌐 ${T('lang')}</button><button id="mSound">${Audio_.on?'🔊':'🔇'} ${T('sound')}</button><button id="mMusic">${Audio_.musicOn?'🎵':'🎵✖'} ${T('music')}</button><button id="mHelp">❓ ${T('help')}</button><button id="mQuit" class="danger">⏏ ${T('quit')}</button></div>`;
  openModal(html);$('#mSave').onclick=()=>{Save.save(user,st.mode,st);toast('💾 '+T('save')+' ✓');};$('#mExport').onclick=()=>{Save.save(user,st.mode,st);Save.exportJSON(user,st.mode);};
  $('#mLang').onclick=()=>{setLang(LANG==='es'?'en':'es');applyLang();closeModal();refresh();};$('#mSound').onclick=()=>{Audio_.toggleSound();openMenu();};$('#mMusic').onclick=()=>{Audio_.toggleMusic();openMenu();};
  $('#mHelp').onclick=()=>openHelp();$('#mQuit').onclick=()=>{Save.save(user,st.mode,st);closeModal();showTitle();};}
function openHelp(){openModal(`<h3>❓ ${T('help')}</h3>${L({es:`<ul class="help"><li><b>Objetivo:</b> dominar el 60 % del río (40 % en partida rápida), adquirir 16 genes nuevos (14), mantener 2 sintrofias por 10 turnos (8), o tener el mejor puntaje al final (victoria ecológica si no tienes guerras y quedan ≥ 4 facciones).</li><li><b>Turno:</b> 3 acciones. Colonizar/competir (⚡3), biofilm (🟢), vesículas (🟢3), adquirir gen, cambiar c-di-GMP. Luego “Terminar turno” (Enter).</li><li><b>Aptitud:</b> depende del pH y la temperatura reales del hex frente a tu óptimo. Río abajo es fácil (corriente), río arriba cuesta (flagelos ayudan).</li><li><b>c-di-GMP alto:</b> puedes construir biofilm y defiendes mejor, pero solo colonizas río abajo adyacente. <b>Bajo:</b> más alcance y éxito, sin biofilm.</li><li><b>Biofilm:</b> nivel 1 libre, nivel 2 con EPS, nivel 3 con Pel y población ≥ 5 (≥ 3 con quorum sensing).</li><li><b>Genes:</b> mutación (caro), conjugación (vecino con el gen y relación ≥ 0), transformación (ADN libre 🧬 en tu hex) o transducción (tras una tormenta de fagos).</li><li><b>Vesículas:</b> enzimas = regalo (+relación), toxinas = ataque a distancia, ADN = escudo anti‑fago en tu hex o gen para otro (con ICE).</li><li><b>Teclas:</b> Enter termina turno · Esc cancela/cierra · G genes · D diplomacia · P pedia · C c‑di‑GMP · rueda = zoom · arrastrar = mover.</li></ul>`,en:`<ul class="help"><li><b>Goal:</b> dominate 60 % of the river (40 % in a quick game), acquire 16 new genes (14), keep 2 syntrophies for 10 turns (8), or have the top score at the end (ecological victory if you have no wars and ≥ 4 factions survive).</li><li><b>Turn:</b> 3 actions. Colonize/compete (⚡3), biofilm (🟢), vesicles (🟢3), acquire a gene, switch c-di-GMP. Then “End turn” (Enter).</li><li><b>Fitness:</b> depends on the hex’s real pH and temperature vs your optimum. Downstream is easy (current), upstream is hard (flagella help).</li><li><b>High c-di-GMP:</b> you can build biofilm and defend better, but only colonize adjacent downstream. <b>Low:</b> more range and success, no biofilm.</li><li><b>Biofilm:</b> level 1 free, level 2 needs EPS, level 3 needs Pel and population ≥ 5 (≥ 3 with quorum sensing).</li><li><b>Genes:</b> mutation (expensive), conjugation (neighbour with the gene and relation ≥ 0), transformation (free DNA 🧬 in your hex) or transduction (after a phage storm).</li><li><b>Vesicles:</b> enzymes = gift (+relation), toxins = ranged attack, DNA = anti‑phage shield in your hex or a gene for another faction (with ICE).</li><li><b>Keys:</b> Enter ends turn · Esc cancels/closes · G genes · D diplomacy · P pedia · C c‑di‑GMP · wheel = zoom · drag = pan.</li></ul>`})}`,true);}
// ---------- modal ----------
function openModal(html,wide){const m=$('#modal');m.querySelector('.box').innerHTML=html+`<button class="close" id="mClose">✕</button>`;m.classList.add('open');m.querySelector('.box').classList.toggle('wide',!!wide);$('#mClose').onclick=closeModal;}
function closeModal(){$('#modal').classList.remove('open');}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
// ---------- turn ----------
$('#btnEnd').onclick=()=>endTurn();
function endTurn(){if(!st||st.over)return;cancelMode();Audio_.sfx('turn');pendingMsgs=[];
  const say=(f,kind,d)=>pendingMsgs.push({f,kind,d});
  for(const F of FACTIONS){if(F.id===st.human)continue;AI.takeTurn(F.id,st,map,say);}
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
  if(e.key==='Enter'&&!$('#modal').classList.contains('open'))endTurn();
  if(e.key==='g'||e.key==='G')openGenes();if(e.key==='d'||e.key==='D')openDiplo();if(e.key==='p'||e.key==='P')openPedia('fac');if(e.key==='h'||e.key==='H')openHelp();if(e.key==='c'||e.key==='C')$('#cdgBtn').click();}
// ---------- lang ----------
function applyLang(){$$('[data-i]').forEach(el=>el.textContent=T(el.dataset.i));document.documentElement.lang=LANG;$('#langBtn').textContent=T('lang');if(!st)renderUsers();}
$('#langBtn').onclick=()=>{setLang(LANG==='es'?'en':'es');applyLang();};
window.COLON={get st(){return st;},get map(){return map;},endTurn,startNew};
document.addEventListener('DOMContentLoaded',boot);
})();
