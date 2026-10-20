// COLONIZATION — IA de las facciones (personalidades: agresividad, expansión, diplomacia)
'use strict';
const AI=(()=>{
const R=Math.random;
const PRIORITY={auto:['rubisco','proton','eps','flagellum','pel','crispr','rus','nif','qs','bacteriocin','omv','ice','heat','kdp','ars','sre','oxidase','spore','sox'],
  hetero:['proton','eps','flagellum','pel','crispr','qs','omv','bacteriocin','ice','sre','oxidase','heat','kdp','ars','nif','spore','rubisco','sox','rus'],
  mixo:['rubisco','rus','proton','eps','flagellum','pel','crispr','bacteriocin','omv','qs','ice','nif','heat','kdp','ars','sre','oxidase','sox','spore']};
function takeTurn(f,st,map,say){
  const F=FBY[f],P=st.factions[f];if(!P.alive)return;const pr=F.personality;
  // c-di-GMP strategy
  const terr=Rules.territory(st,f);const warN=Object.keys(st.wars).filter(k=>k.split('|').indexOf(f)>=0).length;
  const wantHigh=(terr>=7&&R()<.5)||(warN>0&&pr.aggr<.5)||(terr>=10);
  if(!P.cdgPending&&((wantHigh&&P.cdg==='low')||(!wantHigh&&P.cdg==='high'&&terr<6&&R()<.4)))Rules.doCdg(f,st);
  let guard=0;
  while(P.actions>0&&guard++<8){
    // 1. genes
    let did=false;
    if(R()<.35){const list=(PRIORITY[F.metab]||PRIORITY.auto).filter(x=>GBY[x].show);for(const g of list){if(Rules.has(st,f,g))continue;const r=Rules.geneRoutes(f,st,g,map)[0];const c=Rules.geneCost(g,r.k,st,f);
        if(P.res.energy>=c.energy+4&&P.res.carbon>=c.carbon+3){const res=Rules.doGene(f,st,g,map);if(res.ok){did=true;if(say&&R()<.3)say(f,'gene',{g,via:res.via});}break;}
        break;}}
    if(did)continue;
    // 2. colonize / compete
    let best=null;
    for(const i of map.playable){const s=st.hexes[i];if(s.owner!==f||s.pop<3.5)continue;
      for(const j of Rules.colonizeTargets(f,st,i,map)){const t=st.hexes[j];const h=map.d.hexes[j];let v;
        if(!t.owner){v=Rules.colonizeOdds(f,st,i,j,map)*(h.site?1.25:1)*(h.t==='lake'?1.1:1);}
        else{if(Rules.isAllied(st,f,t.owner)||st.turn<6)continue;const p=Rules.combat(f,st,i,j,map);const hostile=Rules.atWar(st,f,t.owner)||Rules.rel(st,f,t.owner)<-15;v=(p>.62&&(hostile||R()<pr.aggr*.5))?p*.9*pr.aggr+.2:0;}
        if(v>.3&&(!best||v>best.v))best={v,i,j};}}
    if(best&&P.res.energy>=3){const r=Rules.doColonize(f,st,best.i,best.j,map);if(r.ok){did=true;if(say&&st.hexes[best.j].owner===f&&R()<.25)say(f,'colonize',{to:best.j});if(say&&r.won===false&&R()<.2)say(f,'failed',{to:best.j});}}
    if(did)continue;
    // 3. biofilm
    if(P.cdg==='high'){let bi=null;for(const i of map.playable){const s=st.hexes[i];if(s.owner!==f||s.pop<4)continue;if(Rules.canBiofilm(f,st,i)==='ok'){const v=s.pop+(map.d.hexes[i].site?2:0)+s.biofilm;if(!bi||v>bi.v)bi={v,i};}}
      if(bi){Rules.doBiofilm(f,st,bi.i);did=true;}}
    if(did)continue;
    // 4. OMV
    if(P.res.carbon>=6&&R()<.6){let sent=false;for(const i of map.playable){const s=st.hexes[i];if(s.owner!==f)continue;for(const j of Rules.omvTargets(f,st,i,map)){const t=st.hexes[j];if(!t.owner||t.owner===f)continue;
          if(Rules.atWar(st,f,t.owner)&&R()<pr.aggr){Rules.doOMV(f,st,i,j,'toxin',map);if(say&&R()<.4)say(f,'toxin',{d:t.owner,to:j});sent=true;break;}
          if(Rules.isAllied(st,f,t.owner)&&R()<pr.diplo*.4){Rules.doOMV(f,st,i,j,'enzyme',map);sent=true;break;}}
        if(sent)break;}
      if(sent){did=true;continue;}}
    // 5. diplomacy
    if(R()<pr.diplo*.5){for(const O of FACTIONS){const o=O.id;if(o===f||!st.factions[o].alive)continue;const k=Rules.KEY(f,o);
        if(!st.alliances[k]&&!st.wars[k]&&Rules.complementary(f,o)&&Rules.rel(st,f,o)>=10){
          if(o===st.human){if(say)say(f,'proposeAlly',{});break;}
          else if(Rules.aiAccepts(st,o,f,'syntrophy')){st.alliances[k]=st.turn;Rules.addRel(st,f,o,20);Rules.log(st,'ally',{f,d:o});break;}}
        if(st.wars[k]&&Rules.strength(st,f)<Rules.strength(st,o)*.8&&R()<.5){if(o===st.human){if(say)say(f,'proposePeace',{});}else if(Rules.aiAccepts(st,o,f,'peace')){delete st.wars[k];st.relations[k]=Math.max(st.relations[k],-20);Rules.log(st,'peace',{f,d:o});}break;}
        if(!st.wars[k]&&pr.aggr>.55&&Rules.rel(st,f,o)<-20&&Rules.strength(st,f)>Rules.strength(st,o)*1.3&&R()<.3){Rules.propose(st,f,o,'war',map);if(say&&o===st.human)say(f,'war',{});break;}}}
    break;
  }
}
// AI answers to human proposals handled in Rules.aiAccepts; pending AI proposals to the human are stored in st.msgs by say()
return {takeTurn};
})();
