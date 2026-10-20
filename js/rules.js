// COLONIZATION — reglas: estado, aptitud ecológica, recursos, colonización, biofilm, c-di-GMP, OMV, genes, diplomacia, eventos, victoria
'use strict';
const Rules=(()=>{
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const R=()=>Math.random();
const MAX_POP=10;
const ACTIONS_PER_TURN=3;
const KEY=(a,b)=>a<b?a+'|'+b:b+'|'+a;

function newState(map,opts){
  const st={mode:opts.mode,turn:1,maxTurns:opts.mode==='quick'?25:120,human:opts.faction,user:opts.user,created:Date.now(),
    hexes:new Array(map.d.hexes.length).fill(null),factions:{},relations:{},alliances:{},wars:{},events:[],activeMods:[],log:[],msgs:[],winner:null,over:false,era:0,phase:'human',timer:opts.mode==='quick'?75:0};
  for(const i of map.playable){const h=map.d.hexes[i];st.hexes[i]={owner:null,pop:0,biofilm:0,eff:{ph:h.ph,T:h.T,fe:h.fe,so4:h.so4,o2:h.o2,ec:h.ec,as:h.as||0},shield:0,eDNA:null,eDNAttl:0};}
  for(const f of FACTIONS){st.factions[f.id]={res:{energy:10,carbon:8,nutrients:6},genes:f.genes.slice(),acquired:0,cdg:f.personality.expand>.65?'low':'high',cdgPending:null,alive:true,actions:ACTIONS_PER_TURN,score:0,allySince:{}};
    const home=map.d.siteHex[f.home];const hs=st.hexes[home];hs.owner=f.id;hs.pop=5;hs.biofilm=f.bonus.biofilm?1:0;
    // a second seed hex: best adjacent water hex by fitness
    let best=null;for(const j of map.nbr[home]){const s2=st.hexes[j];if(!s2||s2.owner)continue;const fit=fitness(f.id,st,j,map);if(!best||fit>best[0])best=[fit,j];}
    if(best&&best[0]>.2){st.hexes[best[1]].owner=f.id;st.hexes[best[1]].pop=3;}
  }
  for(let a=0;a<FACTIONS.length;a++)for(let b=a+1;b<FACTIONS.length;b++){const fa=FACTIONS[a],fb=FACTIONS[b];let r=0;if(fa.metab!==fb.metab)r+=15;if(Math.abs(fa.phOpt-fb.phOpt)<1)r-=10;st.relations[KEY(fa.id,fb.id)]=r;}
  return st;
}
function has(st,f,g){return st.factions[f].genes.indexOf(g)>=0;}
function phTol(f,st){return FBY[f].phTol+(has(st,f,'proton')?.5:0);}
function tTol(f,st){return FBY[f].tTol+(has(st,f,'heat')?4:0)+(FBY[f].bonus.heat?2:0);}
function fitness(f,st,i,map){
  const F=FBY[f];const hs=st.hexes[i];if(!hs)return 0;const e=hs.eff;
  let fit=Math.exp(-Math.pow((e.ph-F.phOpt)/phTol(f,st),2))*Math.exp(-Math.pow((e.T-F.tOpt)/tTol(f,st),2));
  if(e.o2<20&&F.o2need>.5&&!has(st,f,'sre')&&!has(st,f,'oxidase')&&!F.bonus.anaerobe)fit*=.5;
  if((e.as>.5||e.ec>25000)&&!has(st,f,'ars')&&!F.bonus.metal)fit*=.8;
  if(e.ec>20000&&!has(st,f,'kdp')&&!F.bonus.osmo)fit*=.85;
  if(st.activeMods.some(m=>m.id==='drought')&&!has(st,f,'kdp')&&!F.bonus.osmo)fit*=.7;
  return clamp(fit,0,1);
}
function organic(st,i,map){const h=map.d.hexes[i];let org=(h.ph>=5.5?2:h.ph>=3.5?1.2:.6);for(const j of map.nbr[i]){const s=st.hexes[j];if(s&&s.owner&&FBY[s.owner].metab==='auto')org+=.5*Math.min(s.pop,6)/6;}return org;}
function yields(f,st,i,map){
  const F=FBY[f],hs=st.hexes[i],h=map.d.hexes[i],e=hs.eff;const fit=fitness(f,st,i,map);const popk=clamp(hs.pop,0,MAX_POP)/5;
  let energy=.4,carbon=0,nut=(e.ph>=5.5?1.6:1.0);
  const sulfurHere=h.t==='spring'||h.t==='crater'||(e.so4>1500)||map.nbr[i].some(j=>map.d.hexes[j].t==='fumarole');
  if(has(st,f,'sox')&&sulfurHere)energy+=2*(F.bonus.energyS||1);
  if(has(st,f,'rus')){if(e.fe>50)energy+=2*(F.bonus.energyFe||1);else if(e.fe>3)energy+=1*(F.bonus.energyFe||1);}
  const org=organic(st,i,map);
  if(F.metab!=='auto'){energy+=org*(F.bonus.carbonHetero||1);carbon+=org*(F.bonus.carbonHetero||1);}
  if(F.metab!=='hetero'){carbon+=has(st,f,'rubisco')?1.5:.5;}
  if(F.auxotroph){const nb=map.nbr[i].some(j=>st.hexes[j]&&st.hexes[j].owner&&st.hexes[j].owner!==f&&FBY[st.hexes[j].owner].metab!=='auto');carbon*=(nb||e.ph>5)?1.5:.8;}
  if(has(st,f,'nif'))nut+=1.5;nut*=(F.bonus.nutrients||1);nut+=.3*hs.biofilm;
  if(st.activeMods.some(m=>m.id==='ash'))nut+=1;
  // syntrophy bonus
  for(const j of map.nbr[i]){const s=st.hexes[j];if(s&&s.owner&&s.owner!==f&&isAllied(st,f,s.owner)){if(F.metab==='auto')energy+=.5;else carbon+=.5;}}
  const k=popk*(0.35+0.65*fit);
  return {energy:energy*k,carbon:carbon*k,nutrients:nut*k,fit};
}
function isAllied(st,a,b){return !!st.alliances[KEY(a,b)];}
function atWar(st,a,b){return !!st.wars[KEY(a,b)];}
function rel(st,a,b){return st.relations[KEY(a,b)]||0;}
function addRel(st,a,b,d){const k=KEY(a,b);st.relations[k]=clamp((st.relations[k]||0)+d,-100,100);if(st.relations[k]<-40&&!st.wars[k]){st.wars[k]=st.turn;delete st.alliances[k];}}
function capacity(st,i,map){const hs=st.hexes[i];const h=map.d.hexes[i];let cap=(h.t==='lake'?7:h.t==='falls'?6:h.t==='pond'?5:6)+hs.biofilm*1.3;return Math.min(MAX_POP,cap);}
function colonizeRange(f,st){const F=FBY[f];let r=1+(has(st,f,'flagellum')?1:0);if(F.bonus.range)r=Math.max(r,F.bonus.range);if(st.factions[f].cdg==='high')r=1;return r;}
function downstreamOf(map,i,j){return map.d.hexes[i].down.indexOf(j)>=0;}
function reachableDown(map,i,n){const out=new Set();let fr=[i];for(let k=0;k<n;k++){const nx=[];for(const a of fr)for(const b of map.d.hexes[a].down){if(!out.has(b)){out.add(b);nx.push(b);}}fr=nx;}return out;}
function colonizeTargets(f,st,from,map){const r=colonizeRange(f,st);const hs=st.hexes[from];if(!hs||hs.owner!==f||hs.pop<3)return [];
  const out=[];const high=st.factions[f].cdg==='high';
  for(const j of map.playable){if(j===from)continue;const d=map.dist(from,j);if(high){if(!downstreamOf(map,from,j))continue;}else if(d>r)continue;const t=st.hexes[j];if(t.owner===f)continue;if(t.owner&&isAllied(st,f,t.owner))continue;out.push(j);}
  return out;}
function colonizeOdds(f,st,from,to,map){let p=fitness(f,st,to,map);const F=FBY[f];
  if(downstreamOf(map,from,to))p*=1.25;else if(downstreamOf(map,to,from))p*=(has(st,f,'flagellum')?.85:.6);else p*=.9;
  if(st.factions[f].cdg==='low')p*=1.2;return clamp(p,.03,.97);}
function combat(f,st,from,to,map){const t=st.hexes[to];const d=t.owner;const Fd=FBY[d],Fa=FBY[f];
  const att=st.hexes[from].pop*fitness(f,st,to,map)*(has(st,f,'bacteriocin')?1.5:1)*(st.factions[f].cdg==='low'?1.1:1)*(Fa.bonus.attack||1);
  const def=1.3*Math.max(.5,t.pop)*Math.max(.15,fitness(d,st,to,map))*(1+t.biofilm*.5+(has(st,d,'eps')?.5:0)+(Fd.bonus.defense||0)+(st.factions[d].cdg==='high'?.3:0));
  return att/(att+def);}
function doColonize(f,st,from,to,map){
  const P=st.factions[f];if(P.actions<=0)return {ok:false,msg:'noActions'};if(P.res.energy<3)return {ok:false,msg:'notEnough'};
  if(colonizeTargets(f,st,from,map).indexOf(to)<0)return {ok:false,msg:'tooFar'};
  P.actions--;P.res.energy-=3;const s=st.hexes[from],t=st.hexes[to];
  if(t.owner&&t.owner!==f){const p=combat(f,st,from,to,map);const d=t.owner;addRel(st,f,d,-30);st.wars[KEY(f,d)]=st.turn;delete st.alliances[KEY(f,d)];
    if(R()<p){const keep=Math.max(1,Math.floor(t.pop/2));leaveDNA(st,to,d);t.owner=f;t.pop=Math.min(keep,2);t.biofilm=0;s.pop-=1;log(st,'won',{f,d,to});return {ok:true,won:true,p};}
    else{s.pop-=2;t.pop=Math.max(1,t.pop-1);log(st,'lost',{f,d,to});return {ok:true,won:false,p};}}
  const p=colonizeOdds(f,st,from,to,map);
  if(R()<p){t.owner=f;t.pop=2;t.biofilm=0;s.pop-=2;if(t.eDNA&&t.eDNA.owner===f){t.eDNA=null;}log(st,'colonized',{f,to});return {ok:true,won:true,p};}
  s.pop-=1;log(st,'failed',{f,to});return {ok:true,won:false,p};
}
function leaveDNA(st,i,dead){const g=st.factions[dead].genes;const pick=g.length?g[Math.floor(R()*g.length)]:null;if(pick)st.hexes[i].eDNA={owner:dead,gene:pick};st.hexes[i].eDNAttl=4;}
function biofilmMax(f,st){const F=FBY[f];let m=1;if(has(st,f,'eps')||F.bonus.biofilm||F.bonus.biofilmCost)m=2;if(has(st,f,'pel'))m=3;return m;}
function biofilmCost(f,st,i){const lvl=st.hexes[i].biofilm;return Math.round(4*(lvl+1)*(FBY[f].bonus.biofilmCost||1));}
function canBiofilm(f,st,i){const P=st.factions[f],hs=st.hexes[i];if(!hs||hs.owner!==f)return 'no';if(P.cdg!=='high')return 'cdg';if(hs.biofilm>=biofilmMax(f,st))return 'max';
  if(hs.biofilm===2&&hs.pop<(has(st,f,'qs')?3:5))return 'pop';if(P.res.carbon<biofilmCost(f,st,i))return 'notEnough';if(P.actions<=0)return 'noActions';return 'ok';}
function doBiofilm(f,st,i){const c=canBiofilm(f,st,i);if(c!=='ok')return {ok:false,msg:c};const P=st.factions[f];P.res.carbon-=biofilmCost(f,st,i);P.actions--;st.hexes[i].biofilm++;log(st,'biofilm',{f,i,lvl:st.hexes[i].biofilm});return {ok:true};}
function doCdg(f,st){const P=st.factions[f];if(P.actions<=0)return {ok:false,msg:'noActions'};P.actions--;P.cdgPending=P.cdg==='high'?'low':'high';return {ok:true};}
// ---- OMV ----
function omvTargets(f,st,from,map){const hs=st.hexes[from];if(!hs||hs.owner!==f)return [];const r=has(st,f,'omv')?3:2;const set=new Set(map.hexesWithin(from,r));for(const j of reachableDown(map,from,has(st,f,'omv')?8:4))set.add(j);set.delete(from);return [...set].filter(j=>st.hexes[j]);}
function doOMV(f,st,from,to,type,map,gene){const P=st.factions[f];if(P.actions<=0)return {ok:false,msg:'noActions'};if(P.res.carbon<3)return {ok:false,msg:'notEnough'};
  if(omvTargets(f,st,from,map).indexOf(to)<0&&to!==from)return {ok:false,msg:'tooFar'};
  const strong=has(st,f,'omv')?2:1;const t=st.hexes[to];P.actions--;P.res.carbon-=3;
  if(type==='enzyme'){if(t.owner&&t.owner!==f){const Q=st.factions[t.owner];Q.res.energy+=2*strong;Q.res.carbon+=2*strong;addRel(st,f,t.owner,10*strong);log(st,'omvGift',{f,d:t.owner,to});}else if(t.owner===f){t.pop=Math.min(capacity(st,to,map),t.pop+1);}return {ok:true};}
  if(type==='toxin'){if(t.owner&&t.owner!==f){const dmg=(has(st,f,'bacteriocin')?2:1)*strong*(st.hexes[to].biofilm?.6:1);t.pop-=dmg*1.5;addRel(st,f,t.owner,-25);delete st.alliances[KEY(f,t.owner)];log(st,'omvToxin',{f,d:t.owner,to,dmg});if(t.pop<=0){leaveDNA(st,to,t.owner);t.owner=null;t.pop=0;t.biofilm=0;}}return {ok:true};}
  if(type==='dna'){if(t.owner===f||!t.owner){t.shield=3+strong;log(st,'omvShield',{f,to});}
    else{if(has(st,f,'ice')&&gene&&has(st,f,gene)&&!has(st,t.owner,gene)){st.factions[t.owner].genes.push(gene);addRel(st,f,t.owner,25);log(st,'omvGene',{f,d:t.owner,gene});}
      else{const g=P.genes[Math.floor(R()*P.genes.length)];t.eDNA={owner:f,gene:g};t.eDNAttl=4;addRel(st,f,t.owner,10);log(st,'omvDNA',{f,d:t.owner,gene:g});}}return {ok:true};}
  return {ok:false};}
// ---- genes ----
function geneRoutes(f,st,g,map){const routes=[{via:'mutation',k:1}];const P=st.factions[f];
  // conjugation: adjacent hex owned by a faction with the gene and relation >= 0
  for(const i of map.playable){const s=st.hexes[i];if(s.owner!==f)continue;for(const j of map.nbr[i]){const t=st.hexes[j];if(t&&t.owner&&t.owner!==f&&has(st,t.owner,g)&&(rel(st,f,t.owner)>=0||isAllied(st,f,t.owner))){routes.push({via:'conjugation',k:has(st,f,'ice')?.25:.5,from:t.owner});break;}}}
  for(const i of map.playable){const s=st.hexes[i];if(s.owner===f&&s.eDNA&&s.eDNA.gene===g){routes.push({via:'transformation',k:.4,hex:i});break;}}
  if(P.phageGene===g)routes.push({via:'transduction',k:.3});
  routes.sort((a,b)=>a.k-b.k);return routes;}
function geneCost(g,k,st,f){const G=GBY[g];const n=(st&&f)?(st.factions[f].acquired||0):0;const m=2*(1+.25*n);return {energy:Math.ceil(G.cost.energy*k*m),carbon:Math.ceil(G.cost.carbon*k*m)};}
function doGene(f,st,g,map){const P=st.factions[f];if(has(st,f,g))return {ok:false,msg:'owned'};if(P.actions<=0)return {ok:false,msg:'noActions'};
  const r=geneRoutes(f,st,g,map)[0];const c=geneCost(g,r.k,st,f);if(P.res.energy<c.energy||P.res.carbon<c.carbon)return {ok:false,msg:'notEnough'};
  P.res.energy-=c.energy;P.res.carbon-=c.carbon;P.actions--;P.genes.push(g);P.acquired=(P.acquired||0)+1;if(r.via==='transformation'){st.hexes[r.hex].eDNA=null;}if(r.via==='transduction')P.phageGene=null;
  if(r.via==='conjugation'&&r.from)addRel(st,f,r.from,3);log(st,'gene',{f,g,via:r.via});return {ok:true,via:r.via};}
// ---- diplomacy ----
function complementary(a,b){const A=FBY[a],B=FBY[b];return (A.metab==='auto'&&B.metab!=='auto')||(B.metab==='auto'&&A.metab!=='auto');}
function aiAccepts(st,ai,other,kind){const F=FBY[ai];const r=rel(st,ai,other);
  if(kind==='syntrophy')return complementary(ai,other)&&r>=15+(1-F.personality.diplo)*25&&!atWar(st,ai,other);
  if(kind==='peace'){const sa=strength(st,ai),sb=strength(st,other);return r>-45||sa<sb*.7;}
  return false;}
function propose(st,f,o,kind,map){const k=KEY(f,o);
  if(kind==='gift'){const P=st.factions[f];if(P.res.energy<3)return {ok:false,msg:'notEnough'};P.res.energy-=3;addRel(st,f,o,10);return {ok:true,accepted:true};}
  if(kind==='war'){st.wars[k]=st.turn;delete st.alliances[k];addRel(st,f,o,-50);log(st,'war',{f,d:o});return {ok:true,accepted:true};}
  const acc=aiAccepts(st,o,f,kind);
  if(acc){if(kind==='syntrophy'){st.alliances[k]=st.turn;delete st.wars[k];addRel(st,f,o,20);log(st,'ally',{f,d:o});}
    if(kind==='peace'){delete st.wars[k];st.relations[k]=Math.max(st.relations[k],-20);log(st,'peace',{f,d:o});}}
  else addRel(st,f,o,-3);
  return {ok:true,accepted:acc};}
function strength(st,f){let s=0;for(const h of st.hexes)if(h&&h.owner===f)s+=h.pop+h.biofilm*2;return s;}
function territory(st,f){let n=0;for(const h of st.hexes)if(h&&h.owner===f)n++;return n;}
// ---- world turn ----
function applyEventStart(st,map){
  const every=st.mode==='quick'?4:5;if(st.turn%every!==0||st.turn<3)return null;
  const pool=EVENTS.filter(e=>!st.activeMods.some(m=>m.id===e.id));const ev=pool[Math.floor(R()*pool.length)];const m={id:ev.id,ttl:2,data:{}};
  if(ev.id==='phage'||ev.id==='expedition'){const owned=map.playable.filter(i=>st.hexes[i].owner);const i=owned[Math.floor(R()*owned.length)];m.data.hex=i;m.ttl=1;
    const h=st.hexes[i];const f=h.owner;
    if(ev.id==='phage'){if(!has(st,f,'crispr')&&h.shield<=0){h.pop-=3;if(FBY[f].bonus.spore||has(st,f,'spore'))h.pop=Math.max(1,h.pop);
        // transduction: a random gene from a random other faction becomes available
        const others=FACTIONS.filter(x=>x.id!==f);const o=others[Math.floor(R()*others.length)];const g=st.factions[o.id].genes.filter(x=>!has(st,f,x));if(g.length)st.factions[f].phageGene=g[Math.floor(R()*g.length)];}
      if(h.pop<=0){leaveDNA(st,i,f);h.owner=null;h.pop=0;h.biofilm=0;}}
    if(ev.id==='expedition'){h.pop=Math.max(1,Math.floor(h.pop/2));}}
  st.activeMods.push(m);st.events.push({turn:st.turn,id:ev.id,hex:m.data.hex});log(st,'event',{id:ev.id,hex:m.data.hex});return ev;}
function effective(st,map){
  const mods=st.activeMods;
  for(const i of map.playable){const h=map.d.hexes[i],s=st.hexes[i];const e=s.eff;e.ph=h.ph;e.T=h.T;e.fe=h.fe;e.so4=h.so4;e.o2=h.o2;e.ec=h.ec;e.as=h.as||0;
    // owner chemistry: sulfur oxidizers acidify, iron oxidizers precipitate Fe (ochre), neutrals buffer slightly
    if(s.owner){const F=FBY[s.owner];if(F.bonus.acidify&&s.pop>=3)e.ph=Math.max(.5,e.ph-F.bonus.acidify*(s.pop/5));if(F.bonus.energyFe&&s.pop>=3)e.fe=e.fe*1.15;if(s.owner==='neut'&&s.pop>=4)e.ph=Math.min(8,e.ph+.15);}
    // neighbours acidify a little
    for(const j of map.nbr[i]){const t=st.hexes[j];if(t&&t.owner&&FBY[t.owner].bonus.acidify&&t.pop>=4)e.ph=Math.max(.5,e.ph-.1);}
    for(const m of mods){if(m.id==='eruption'&&(h.river==='Río Agrio Superior'||h.t==='crater'||h.t==='spring'))e.ph=Math.max(.3,e.ph-1.5);
      if(m.id==='melt'&&(h.river==='Río Agrio Superior'||h.river==='Río Agrio Inferior'||h.t==='lake'))e.ph=Math.min(8,e.ph+1);
      if(m.id==='summer')e.T+=6;if(m.id==='ash')e.o2=Math.max(3,e.o2-15);if(m.id==='drought')e.ec*=2;}
  }
}
function worldTurn(st,map){
  // yields and growth
  for(const F of FACTIONS){const f=F.id,P=st.factions[f];if(!P.alive)continue;let inc={energy:0,carbon:0,nutrients:0};
    for(const i of map.playable){const s=st.hexes[i];if(s.owner!==f)continue;const y=yields(f,st,i,map);inc.energy+=y.energy;inc.carbon+=y.carbon;inc.nutrients+=y.nutrients;
      const fit=y.fit;let g=(.9+(F.bonus.growth||0))*fit;if(f==='neut'&&s.eff.ph>=5.5)g*=1.6;if(F.metab==='auto'&&!has(st,f,'rubisco'))g*=.7;
      const nutK=clamp(P.res.nutrients/6,.5,1.2);g*=nutK;
      if(fit<.12)g=-1;else if(fit<.25)g-=.4;
      s.pop=clamp(s.pop+g,0,capacity(st,i,map));
      if(s.pop<=0.2){leaveDNA(st,i,f);s.owner=null;s.pop=0;s.biofilm=0;}
      if(s.shield>0)s.shield--;if(s.eDNA){s.eDNAttl--;if(s.eDNAttl<=0)s.eDNA=null;}}
    P.res.energy=Math.min(45,P.res.energy+inc.energy);P.res.carbon=Math.min(45,P.res.carbon+inc.carbon);P.res.nutrients=Math.min(40,P.res.nutrients*.7+inc.nutrients);
    if(P.cdgPending){P.cdg=P.cdgPending;P.cdgPending=null;}P.actions=ACTIONS_PER_TURN;
    if(territory(st,f)===0){P.alive=false;log(st,'extinct',{f});}
  }
  // relations drift, alliance upkeep, QS bonus
  for(const k in st.relations){const [a,b]=k.split('|');let d=st.relations[k]>0?-1:st.relations[k]<0?1:0;if(st.alliances[k]){d=+2;if(has(st,a,'qs')||has(st,b,'qs'))d+=1;}if(st.wars[k])d=-1;st.relations[k]=clamp(st.relations[k]+d,-100,100);}
  // mods decay
  st.activeMods=st.activeMods.filter(m=>(--m.ttl)>0);
  st.turn++;
  const ev=applyEventStart(st,map);
  effective(st,map);
  st.era=eraOf(st);
  checkVictory(st,map);
  return ev;
}
function eraOf(st){const P=st.factions[st.human];const n=P.genes.length;const allies=Object.keys(st.alliances).filter(k=>k.split('|').indexOf(st.human)>=0).length;if(allies>=2)return 3;if(n>=9)return 2;if(n>=6)return 1;return 0;}
function checkVictory(st,map){if(st.over)return;const total=map.playable.length;const q=st.mode==='quick';const domK=q?.4:.6,genN=q?14:16,allyT=q?8:10;
  for(const F of FACTIONS){const f=F.id;const terr=territory(st,f);
    if(terr>=total*domK){st.over=true;st.winner={f,kind:'domination'};return;}
    if((st.factions[f].acquired||0)>=genN){st.over=true;st.winner={f,kind:'genetic'};return;}
    const allies=Object.keys(st.alliances).filter(k=>k.split('|').indexOf(f)>=0&&st.turn-st.alliances[k]>=allyT);if(allies.length>=2){st.over=true;st.winner={f,kind:'symbiotic'};return;}}
  if(st.turn>st.maxTurns){st.over=true;const sc=FACTIONS.map(F=>[F.id,score(st,F.id,map)]).sort((a,b)=>b[1]-a[1]);const f=sc[0][0];
    const wars=Object.keys(st.wars).filter(k=>k.split('|').indexOf(f)>=0).length;const alive=FACTIONS.filter(F=>st.factions[F.id].alive).length;
    st.winner={f,kind:(wars===0&&alive>=4&&territory(st,f)>=total*.25)?'ecological':'score',scores:sc};}}
function score(st,f,map){const P=st.factions[f];let s=territory(st,f)*3+Math.round(strength(st,f))+P.genes.length*2;s+=Object.keys(st.alliances).filter(k=>k.split('|').indexOf(f)>=0).length*5;return s;}
function log(st,kind,data){st.log.push({turn:st.turn,kind,data});if(st.log.length>300)st.log.shift();}
return {newState,fitness,yields,colonizeTargets,colonizeOdds,combat,doColonize,canBiofilm,doBiofilm,biofilmCost,biofilmMax,doCdg,omvTargets,doOMV,geneRoutes,geneCost,doGene,propose,aiAccepts,complementary,rel,isAllied,atWar,strength,territory,worldTurn,effective,score,capacity,organic,has,KEY,ACTIONS_PER_TURN,addRel,log,leaveDNA};
})();
