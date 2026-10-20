// COLONIZATION — mapa de hexágonos (pointy-top, odd-r) y render del agua
'use strict';
const HexMap=(()=>{
const SQ3=Math.sqrt(3);
function oddrToCube(c,r){const x=c-((r-(r&1))>>1);const z=r;return [x,-x-z,z];}
function hexDist(a,b){const A=oddrToCube(a.c,a.r),B=oddrToCube(b.c,b.r);return Math.max(Math.abs(A[0]-B[0]),Math.abs(A[1]-B[1]),Math.abs(A[2]-B[2]));}
function neighborsOf(c,r,cols,rows){const odd=r&1;const cand=[[c-1,r],[c+1,r],[c-1+odd,r-1],[c+odd,r-1],[c-1+odd,r+1],[c+odd,r+1]];return cand.filter(([a,b])=>a>=0&&a<cols&&b>=0&&b<rows);}
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function lerp(a,b,t){return a+(b-a)*t;}
function hex2rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rgb2css(c,a){return a===undefined?`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`:`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;}
function mix(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];}
// agua según química real: pH y hierro
const C_CRATER=hex2rgb('#a3b9ab'),C_RUST=hex2rgb('#c4461a'),C_RUST2=hex2rgb('#d8762c'),C_ACIDLOW=hex2rgb('#2fb9b1'),C_MID=hex2rgb('#43a88e'),C_NEUT=hex2rgb('#3b8ef0'),C_HOT=hex2rgb('#8fb8c8');
function waterColor(h){
  const ph=h.ph!==undefined?h.ph:7,fe=h.fe||0;
  let c;
  if(ph<1.5)c=mix(C_CRATER,C_RUST,clamp((fe-50)/800,0,1)*.6);
  else if(ph<3.6){const acid=C_ACIDLOW;const k=clamp(Math.log10(fe+1)/3.1,0,1);c=mix(acid,k>.5?mix(C_RUST2,C_RUST,(k-.5)*2):mix(acid,C_RUST2,k*2),k);}
  else if(ph<5.5){const t=(ph-3.6)/1.9;c=mix(mix(C_MID,C_RUST2,clamp(fe/40,0,1)*.5),C_NEUT,t*.5);}
  else c=mix(C_MID,C_NEUT,clamp((ph-5.5)/1.5,0,1));
  if(h.t==='hot')c=mix(c,C_HOT,.5);
  return c;
}
function landColor(el,slope){
  let c;
  if(el<1200)c=mix(hex2rgb('#b39a62'),hex2rgb('#9c8a52'),(el-900)/300);
  else if(el<1700)c=mix(hex2rgb('#8f9150'),hex2rgb('#6f8a48'),(el-1200)/500);
  else if(el<2250)c=mix(hex2rgb('#7c8a58'),hex2rgb('#8a847c'),(el-1700)/550);
  else if(el<2600)c=mix(hex2rgb('#8a847c'),hex2rgb('#b8b3ad'),(el-2250)/350);
  else c=mix(hex2rgb('#d8d6d2'),hex2rgb('#f4f3f0'),clamp((el-2600)/200,0,1));
  const sh=clamp(1+slope*.9,.55,1.35);c=mix(c,[120,118,112],.3);return [c[0]*sh*.92,c[1]*sh*.92,c[2]*sh*.92];
}
class HexMapRenderer{
  constructor(data,canvas){
    this.d=data;this.cv=canvas;this.ctx=canvas.getContext('2d');
    this.cols=data.cols;this.rows=data.rows;this.size=26;this.zoom=1;this.ox=0;this.oy=0;
    this.hover=-1;this.sel=-1;this.particles=[];this.flash={};this.t=0;
    this.byCR={};data.hexes.forEach(h=>{this.byCR[h.c+','+h.r]=h.i;});
    this.waterIdx=data.hexes.filter(h=>h.t!=='land').map(h=>h.i);
    this.playable=data.hexes.filter(h=>h.t!=='land'&&h.t!=='fumarole').map(h=>h.i);
    this.nbr=data.hexes.map(h=>neighborsOf(h.c,h.r,this.cols,this.rows).map(([a,b])=>this.byCR[a+','+b]));
    this.labelsCache=null;this.fit();
  }
  fit(){const W=this.cv.width,H=this.cv.height;const sx=W/((this.cols+.5)*SQ3),sy=H/((this.rows*1.5+.5));this.size=Math.min(sx,sy)*.98;this.zoom=1;this.ox=(W-(this.cols+.5)*SQ3*this.size)/2;this.oy=(H-(this.rows*1.5+.5)*this.size)/2;}
  center(i){const h=this.d.hexes[i];const s=this.size*this.zoom;const x=this.ox+s*SQ3*(h.c+.5+((h.r&1)?.5:0)),y=this.oy+s*(1+h.r*1.5);return [x,y];}
  hexAt(px,py){const s=this.size*this.zoom;let best=-1,bd=1e9;const r0=Math.round((py-this.oy-s)/(1.5*s));for(let r=r0-1;r<=r0+1;r++){if(r<0||r>=this.rows)continue;const c0=Math.round((px-this.ox)/(SQ3*s)-.5-((r&1)?.5:0));for(let c=c0-1;c<=c0+1;c++){if(c<0||c>=this.cols)continue;const i=this.byCR[c+','+r];const [x,y]=this.center(i);const d=(x-px)**2+(y-py)**2;if(d<bd){bd=d;best=i;}}}return (bd<=(s*s))?best:-1;}
  path(ctx,x,y,s,k){k=k||1;ctx.beginPath();for(let a=0;a<6;a++){const ang=Math.PI/180*(60*a-30);const px=x+s*k*Math.cos(ang),py=y+s*k*Math.sin(ang);a?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
  dist(i,j){return hexDist(this.d.hexes[i],this.d.hexes[j]);}
  hexesWithin(i,n){const out=[];for(const j of this.waterIdx){if(this.dist(i,j)<=n&&j!==i)out.push(j);}return out;}
  spawn(i,kind,n){const [x,y]=this.center(i);for(let k=0;k<(n||6);k++)this.particles.push({x:x+(Math.random()-.5)*this.size*this.zoom,y:y+(Math.random()-.5)*this.size*this.zoom*.6,vx:(Math.random()-.5)*.4,vy:-.5-Math.random(),life:1,kind});}
  // ---------- render ----------
  draw(state,dt){
    this.t+=dt;const ctx=this.ctx,W=this.cv.width,H=this.cv.height,s=this.size*this.zoom,d=this.d,t=this.t;
    ctx.fillStyle='#0b0f14';ctx.fillRect(0,0,W,H);
    const hs=state?state.hexes:null;
    // land first
    for(const h of d.hexes){const [x,y]=this.center(h.i);if(x<-s||y<-s||x>W+s||y>H+s)continue;
      if(h.t!=='land'&&h.t!=='fumarole')continue;
      const e=d.elev[h.i];const ne=this.nbr[h.i];let slope=0;if(ne.length){let sum=0,n=0;for(const j of ne){const hj=d.hexes[j];if(hj.c<h.c||hj.r<h.r){sum+=(e-d.elev[j]);n++;}}slope=n?clamp(sum/n/120,-1,1):0;}
      const c=landColor(e,slope);this.path(ctx,x,y,s,1.02);ctx.fillStyle=rgb2css(c);ctx.fill();
      if(h.t==='fumarole'){this.path(ctx,x,y,s,.72);ctx.fillStyle='#6d6660';ctx.fill();for(let k=0;k<4;k++){const a=t*1.3+k*1.7;ctx.fillStyle='rgba(240,214,60,.75)';ctx.beginPath();ctx.arc(x+Math.cos(a)*s*.42,y+Math.sin(a)*s*.42,s*.1,0,6.28);ctx.fill();}
        ctx.fillStyle='rgba(235,235,230,.15)';for(let k=0;k<3;k++){const ph=(t*.35+k*.33)%1;ctx.beginPath();ctx.arc(x+Math.sin(t+k)*s*.2,y-ph*s*1.4,s*(.25+ph*.35),0,6.28);ctx.fill();}}
    }
    // water
    for(const i of this.waterIdx){const h=d.hexes[i];if(h.t==='fumarole')continue;const [x,y]=this.center(i);if(x<-s||y<-s||x>W+s||y>H+s)continue;
      const st=hs?hs[i]:null;const eff=st&&st.eff?st.eff:h;
      let c=waterColor(eff);
      if(st&&st.owner){const f=FBY[st.owner];const tint=hex2rgb(f.tint);const k=.18+.05*st.pop+.08*st.biofilm;c=mix(c,tint,clamp(k,0,.75));}
      // ripple highlight
      const rip=.06*Math.sin(t*1.7+h.c*.9+h.r*1.3)+.04*Math.sin(t*2.6+h.c*2.1-h.r*.7);
      c=[c[0]*(1+rip),c[1]*(1+rip),c[2]*(1+rip)];
      this.path(ctx,x,y,s,1.02);ctx.fillStyle=rgb2css(c);ctx.fill();
      // current shimmer (bands)
      ctx.save();this.path(ctx,x,y,s,1);ctx.clip();ctx.globalAlpha=.16;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(1,s*.06);
      for(let k=0;k<3;k++){const ph=((t*.5+k*.33+h.c*.1)%1);ctx.beginPath();ctx.moveTo(x-s,y-s*.9+ph*s*1.8+Math.sin(t+k)*s*.1);ctx.quadraticCurveTo(x,y-s*.9+ph*s*1.8-s*.15,x+s,y-s*.9+ph*s*1.8+Math.sin(t*1.3+k)*s*.1);ctx.stroke();}
      ctx.restore();
      // sulfur crust / iron ochre rims
      const ph=eff.ph!==undefined?eff.ph:7,fe=eff.fe||0;
      if(ph<3.2&&(eff.so4>1500||h.t==='spring'||h.t==='crater')){ctx.save();this.path(ctx,x,y,s,.97);ctx.strokeStyle='rgba(238,214,70,.55)';ctx.lineWidth=s*.14;ctx.setLineDash([s*.35,s*.25]);ctx.lineDashOffset=h.i;ctx.stroke();ctx.restore();}
      else if(fe>80){ctx.save();this.path(ctx,x,y,s,.97);ctx.strokeStyle='rgba(210,110,40,.5)';ctx.lineWidth=s*.12;ctx.setLineDash([s*.5,s*.3]);ctx.stroke();ctx.restore();}
      // biofilm crust
      if(st&&st.biofilm){ctx.save();this.path(ctx,x,y,s,.78-st.biofilm*.02);ctx.strokeStyle=rgb2css(hex2rgb(FBY[st.owner].tint),.85);ctx.lineWidth=s*.09*st.biofilm;ctx.setLineDash([s*.2,s*.12]);ctx.lineDashOffset=-t*2;ctx.stroke();ctx.restore();}
      // bubbles / steam
      const T=eff.T||12;
      if(T>30){for(let k=0;k<(T>45?5:3);k++){const ph2=((t*.4+k*.37+h.i*.13)%1);ctx.fillStyle=`rgba(255,255,255,${.5*(1-ph2)})`;ctx.beginPath();ctx.arc(x+Math.sin(k*2.3+h.i)*s*.45,y+s*.6-ph2*s*1.2,s*.05+ph2*s*.03,0,6.28);ctx.fill();}}
      if(T>38){ctx.fillStyle='rgba(240,240,240,.10)';for(let k=0;k<3;k++){const ph2=((t*.25+k*.33+h.i*.07)%1);ctx.beginPath();ctx.arc(x+Math.sin(t*.8+k+h.i)*s*.3,y-ph2*s*1.6,s*(.3+ph2*.4),0,6.28);ctx.fill();}}
      // owner population pips
      if(st&&st.owner&&st.pop>0){const f=FBY[st.owner];ctx.fillStyle=f.color;const n=Math.min(st.pop,10);for(let k=0;k<n;k++){const a=k/10*6.283+t*.4;const rr=s*.46;ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,s*.08,0,6.28);ctx.fill();}
        ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(x,y,s*.3,0,6.28);ctx.fill();ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(9,s*.45)|0}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.round(st.pop),x,y+1);}
      // phage / shield markers
      if(st&&st.shield>0){ctx.strokeStyle='rgba(120,220,255,.9)';ctx.lineWidth=2;this.path(ctx,x,y,s,.6);ctx.stroke();}
      if(st&&st.eDNA){ctx.fillStyle='rgba(255,255,255,.8)';ctx.font=`${Math.max(8,s*.5)|0}px serif`;ctx.textAlign='center';ctx.fillText('🧬',x+s*.55,y-s*.5);}
    }
    // flow arrows
    ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1;
    for(const i of this.waterIdx){const h=d.hexes[i];for(const j of h.down){const [x1,y1]=this.center(i),[x2,y2]=this.center(j);const dx=x2-x1,dy=y2-y1,L2=Math.hypot(dx,dy)||1;const ux=dx/L2,uy=dy/L2;const ph=(t*.6+i*.1)%1;const px=x1+dx*ph,py=y1+dy*ph;ctx.beginPath();ctx.moveTo(px-ux*s*.18-uy*s*.1,py-uy*s*.18+ux*s*.1);ctx.lineTo(px,py);ctx.lineTo(px-ux*s*.18+uy*s*.1,py-uy*s*.18-ux*s*.1);ctx.stroke();}}
    // selection / hover / targets
    if(state&&state.targets){for(const j of state.targets){const [x,y]=this.center(j);this.path(ctx,x,y,s,.9);ctx.strokeStyle=`rgba(255,255,255,${.5+.4*Math.sin(t*5)})`;ctx.lineWidth=2;ctx.stroke();}}
    if(this.hover>=0){const [x,y]=this.center(this.hover);this.path(ctx,x,y,s,1);ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=2;ctx.stroke();}
    if(this.sel>=0){const [x,y]=this.center(this.sel);this.path(ctx,x,y,s,1);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();}
    // labels
    ctx.font=`${Math.max(8,s*.42)|0}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
    for(const code in d.siteHex){const i=d.siteHex[code];const [x,y]=this.center(i);ctx.fillStyle='rgba(0,0,0,.55)';const w=ctx.measureText(code).width+6;ctx.fillRect(x-w/2,y+s*.62,w,s*.5);ctx.fillStyle='#fff';ctx.fillText(code,x,y+s*.66);}
    if(s>14){ctx.font=`italic ${Math.max(9,s*.5)|0}px Georgia,serif`;ctx.fillStyle='rgba(255,255,255,.75)';const named={};for(const i of this.waterIdx){const h=d.hexes[i];if(!h.river||named[h.river]||h.site)continue;const same=this.waterIdx.filter(j=>d.hexes[j].river===h.river);const mid=same[Math.floor(same.length/2)];const [x,y]=this.center(mid);named[h.river]=1;ctx.fillText(h.river,x,y-s*1.15);}}
    // particles
    for(let k=this.particles.length-1;k>=0;k--){const p=this.particles[k];p.x+=p.vx*s*.1;p.y+=p.vy*s*.1;p.life-=dt*.8;if(p.life<=0){this.particles.splice(k,1);continue;}
      ctx.globalAlpha=p.life;ctx.fillStyle=p.kind==='toxin'?'#b0f':p.kind==='gift'?'#8f8':p.kind==='dna'?'#fff':p.kind==='colonize'?'#ffd':'#f80';ctx.beginPath();ctx.arc(p.x,p.y,s*.08,0,6.28);ctx.fill();ctx.globalAlpha=1;}
  }
}
return {HexMapRenderer,waterColor,hexDist,neighborsOf,clamp,lerp};
})();
