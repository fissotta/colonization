// COLONIZATION — tablero estilo Civilization VI: terreno continuo pintado, montañas, bosques, ríos serpenteantes,
// grilla sutil, fronteras de color por territorio y carteles de ciudad en los sitios.
'use strict';
const HexMap=(()=>{
const SQ3=Math.sqrt(3);
function oddrToCube(c,r){const x=c-((r-(r&1))>>1);const z=r;return [x,-x-z,z];}
function hexDist(a,b){const A=oddrToCube(a.c,a.r),B=oddrToCube(b.c,b.r);return Math.max(Math.abs(A[0]-B[0]),Math.abs(A[1]-B[1]),Math.abs(A[2]-B[2]));}
function neighborsOf(c,r,cols,rows){const odd=r&1;const cand=[[c-1,r],[c+1,r],[c-1+odd,r-1],[c+odd,r-1],[c-1+odd,r+1],[c+odd,r+1]];return cand.filter(([a,b])=>a>=0&&a<cols&&b>=0&&b<rows);}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
function hex2rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function css(c,a){return a===undefined?`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`:`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;}
function mix(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];}
function shade(c,k){return [c[0]*k,c[1]*k,c[2]*k];}
function hash(i,j){let h=(i*374761393+j*668265263)|0;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295;}
const C_CRATER=hex2rgb('#b9cfc3'),C_RUST=hex2rgb('#c7491c'),C_RUST2=hex2rgb('#e2782c'),C_ACID=hex2rgb('#2fc1b8'),C_MID=hex2rgb('#3fb391'),C_NEUT=hex2rgb('#3a8fe6'),C_HOT=hex2rgb('#9ac3d3');
function waterColor(h){const ph=h.ph!==undefined?h.ph:7,fe=h.fe||0;let c;
  if(ph<1.5)c=mix(C_CRATER,C_RUST,clamp((fe-50)/800,0,1)*.6);
  else if(ph<3.6){const k=clamp(Math.log10(fe+1)/3.1,0,1);c=k>.5?mix(C_RUST2,C_RUST,(k-.5)*2):mix(C_ACID,C_RUST2,k*2);}
  else if(ph<5.5){c=mix(mix(C_MID,C_RUST2,clamp(fe/40,0,1)*.5),C_NEUT,(ph-3.6)/1.9*.5);}
  else c=mix(C_MID,C_NEUT,clamp((ph-5.5)/1.5,0,1));
  if(h.t==='hot')c=mix(c,C_HOT,.5);return c;}
function landColor(el,v){let c;
  if(el<1500)c=mix(hex2rgb('#d9bd66'),hex2rgb('#c4b55e'),clamp((el-1150)/350,0,1));
  else if(el<1800)c=mix(hex2rgb('#c4b55e'),hex2rgb('#8fb24e'),(el-1500)/300);
  else if(el<2200)c=mix(hex2rgb('#8fb24e'),hex2rgb('#5f9a46'),(el-1800)/400);
  else if(el<2500)c=mix(hex2rgb('#6f9a4e'),hex2rgb('#9a9070'),(el-2200)/300);
  else if(el<2750)c=mix(hex2rgb('#9a9070'),hex2rgb('#b8b2a6'),(el-2500)/250);
  else c=mix(hex2rgb('#d2cec8'),hex2rgb('#f2f1ee'),clamp((el-2750)/250,0,1));
  return shade(c,.93+v*.14);}
class HexMapRenderer{
  constructor(data,canvas){this.d=data;this.cv=canvas;this.ctx=canvas.getContext('2d');this.cols=data.cols;this.rows=data.rows;this.size=40;this.zoom=1;this.ox=0;this.oy=0;
    this.hover=-1;this.sel=-1;this.particles=[];this.t=0;this.byCR={};data.hexes.forEach(h=>{this.byCR[h.c+','+h.r]=h.i;});
    this.waterIdx=data.hexes.filter(h=>!['land','mountain','fumarole'].includes(h.t)).map(h=>h.i);this.playable=this.waterIdx.slice();
    this.nbr=data.hexes.map(h=>neighborsOf(h.c,h.r,this.cols,this.rows).map(([a,b])=>this.byCR[a+','+b]));
    this.areaWater=new Set(this.waterIdx.filter(i=>['lake','crater','pond','hot'].includes(data.hexes[i].t)));
    // river links: adjacent hexes of the same river, plus down links
    this.links=[];const seen=new Set();for(const i of this.waterIdx){const h=data.hexes[i];for(const j of this.nbr[i].concat(h.down)){if(!this.waterIdx.includes(j))continue;const hj=data.hexes[j];if(!(h.down.includes(j)||hj.down.includes(i)||hj.river===h.river))continue;const k=i<j?i+'-'+j:j+'-'+i;if(seen.has(k))continue;seen.add(k);this.links.push([i,j]);}}
    this.tris=[];for(const i of this.waterIdx)for(const j of this.nbr[i])for(const k of this.nbr[i]){if(!(i<j&&j<k))continue;if(!this.waterIdx.includes(j)||!this.waterIdx.includes(k)||!this.nbr[j].includes(k))continue;this.tris.push([i,j,k]);}
    this.orig={};this.terrain=null;this.terrainKey='';this.fit();}
  fillTris(ctx,colFn,grow){for(const [i,j,k] of this.tris){const pts=[this.center(i),this.center(j),this.center(k)];const cx=(pts[0][0]+pts[1][0]+pts[2][0])/3,cy=(pts[0][1]+pts[1][1]+pts[2][1])/3;ctx.fillStyle=colFn(i,j,k);ctx.beginPath();pts.forEach((p,n)=>{const gx=p[0]+(p[0]-cx)*grow,gy=p[1]+(p[1]-cy)*grow;n?ctx.lineTo(gx,gy):ctx.moveTo(gx,gy);});ctx.closePath();ctx.fill();}}
  isLand(i){const t=this.d.hexes[i].t;return t==='land'||t==='mountain'||t==='fumarole';}
  rebuildWater(){const data=this.d;this.waterIdx=data.hexes.filter(h=>!this.isLand(h.i)).map(h=>h.i);this.playable=this.waterIdx.slice();
    this.areaWater=new Set(this.waterIdx.filter(i=>['lake','crater','pond','hot','made'].includes(data.hexes[i].t)));
    this.links=[];const seen=new Set();for(const i of this.waterIdx){const h=data.hexes[i];for(const j of this.nbr[i].concat(h.down)){if(!this.waterIdx.includes(j))continue;const hj=data.hexes[j];if(!(h.down.includes(j)||hj.down.includes(i)||hj.river===h.river||h.t==='made'||hj.t==='made'))continue;const k=i<j?i+'-'+j:j+'-'+i;if(seen.has(k))continue;seen.add(k);this.links.push([i,j]);}}
    this.tris=[];for(const i of this.waterIdx)for(const j of this.nbr[i])for(const k of this.nbr[i]){if(!(i<j&&j<k))continue;if(!this.waterIdx.includes(j)||!this.waterIdx.includes(k)||!this.nbr[j].includes(k))continue;this.tris.push([i,j,k]);}
    this.terrain=null;}
  addWater(i){this.rebuildWater();}
  revertAll(st){this.orig=this.orig||{};for(const i in this.orig){const o=this.orig[i];const h=this.d.hexes[i];for(const k in h)delete h[k];Object.assign(h,o);if(st&&st.hexes[i]&&st.hexes[i].madeBy)st.hexes[i]=null;}this.orig={};this.rebuildWater();}
  fit(){const W=this.cv.width,H=this.cv.height;const sx=W/((this.cols+.8)*SQ3),sy=H/(this.rows*1.5+1.2);this.size=Math.min(sx,sy)*.98;this.zoom=1;this.ox=(W-(this.cols+.5)*SQ3*this.size)/2;this.oy=(H-(this.rows*1.5+.5)*this.size)/2;}
  center(i){const h=this.d.hexes[i];const s=this.size*this.zoom;return [this.ox+s*SQ3*(h.c+.5+((h.r&1)?.5:0)),this.oy+s*(1+h.r*1.5)];}
  top(i){return this.center(i);}
  hexAt(px,py){const s=this.size*this.zoom;let best=-1,bd=1e9;for(const h of this.d.hexes){const [x,y]=this.center(h.i);const d=(px-x)**2+(py-y)**2;if(d<bd){bd=d;best=h.i;}}return bd<=s*s*.9?best:-1;}
  verts(x,y,s,k){k=k||1;const v=[];for(let a=0;a<6;a++){const ang=Math.PI/180*(60*a-30);v.push([x+s*k*Math.cos(ang),y+s*k*Math.sin(ang)]);}return v;}
  path(ctx,x,y,s,k){const v=this.verts(x,y,s,k);ctx.beginPath();v.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
  dist(i,j){return hexDist(this.d.hexes[i],this.d.hexes[j]);}
  hexesWithin(i,n){return this.waterIdx.filter(j=>j!==i&&this.dist(i,j)<=n);}
  spawn(i,kind,n){const [x,y]=this.center(i);for(let k=0;k<(n||6);k++)this.particles.push({x:x+(Math.random()-.5)*this.size*this.zoom,y:y+(Math.random()-.5)*this.size*this.zoom*.5,vx:(Math.random()-.5)*.4,vy:-.5-Math.random(),life:1,kind});}
  // ---------- terreno estático (cacheado) ----------
  buildTerrain(){const W=this.cv.width,Hh=this.cv.height,s=this.size*this.zoom,d=this.d;const cv=document.createElement('canvas');cv.width=W;cv.height=Hh;const ctx=cv.getContext('2d');
    ctx.fillStyle='#8fa655';ctx.fillRect(0,0,W,Hh);
    // mar / fondo fuera del tablero: oscuro
    const bg=ctx.createLinearGradient(0,0,0,Hh);bg.addColorStop(0,'#17212b');bg.addColorStop(1,'#0b1015');ctx.fillStyle=bg;ctx.fillRect(0,0,W,Hh);
    // manchas de terreno
    const order=d.hexes.slice().sort((a,b)=>a.r-b.r||a.c-b.c);
    for(const h of order){const [x,y]=this.center(h.i);const el=d.elev[h.i];const c=landColor(el,hash(h.i,3));const g=ctx.createRadialGradient(x,y,s*.2,x,y,s*1.35);g.addColorStop(0,css(c,1));g.addColorStop(.7,css(c,.9));g.addColorStop(1,css(c,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,s*1.35,0,6.28);ctx.fill();}
    // grano
    for(let k=0;k<W*Hh/90;k++){const x=Math.random()*W,y=Math.random()*Hh;ctx.fillStyle=Math.random()<.5?'rgba(0,0,0,.05)':'rgba(255,255,255,.05)';ctx.fillRect(x,y,2,2);}
    // ríos y lagos (base; la animación va encima)
    this.drawWaterBase(ctx,s);
    // rasgos: pastizal, bosques, cerros, montañas, fumarolas
    for(const h of order){if(!this.isLand(h.i))continue;const [x,y]=this.center(h.i);const el=d.elev[h.i];const rnd=k=>hash(h.i,k);
      if(h.t==='fumarole'){this.volcano(ctx,x,y,s,h.i,true);continue;}
      if(h.t==='mountain'||el>=2550){this.mountain(ctx,x,y,s,h.i,el);continue;}
      if(el>=2150){for(let k=0;k<3;k++){const px=x+(rnd(k)-.5)*s*1.1,py=y+(rnd(k+5)-.5)*s*.8;this.hill(ctx,px,py,s*(.35+rnd(k+9)*.2));}}
      if(el>=1650&&el<2450&&rnd(40)>.3){const n=4+Math.floor(rnd(41)*6);for(let k=0;k<n;k++){const px=x+(rnd(k+50)-.5)*s*1.4,py=y+(rnd(k+70)-.5)*s*1.2;this.tree(ctx,px,py,s*(.14+rnd(k+90)*.1),rnd(k+11)>.5);}}
      if(el<1700){for(let k=0;k<6;k++){const px=x+(rnd(k+30)-.5)*s*1.4,py=y+(rnd(k+60)-.5)*s*1.2;ctx.strokeStyle='rgba(110,100,40,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px-3,py);ctx.lineTo(px,py-s*.12);ctx.lineTo(px+3,py);ctx.stroke();}}
    }
    // volcán Copahue: alrededor del cráter
    const cr=d.siteHex['CL'];if(cr!==undefined){const [x,y]=this.center(cr);this.volcano(ctx,x,y,s,cr,false);}
    // grilla sutil
    ctx.strokeStyle='rgba(0,0,0,.13)';ctx.lineWidth=1;for(const h of d.hexes){const [x,y]=this.center(h.i);this.path(ctx,x,y,s,.985);ctx.stroke();}
    this.terrain=cv;}
  drawWaterBase(ctx,s){const d=this.d;
    // bancos (orilla clara) y cuerpo de agua
    const stroke=(w,colFn,alpha)=>{ctx.lineCap='round';ctx.lineJoin='round';for(const [i,j] of this.links){const [x1,y1]=this.center(i),[x2,y2]=this.center(j);const mx=(x1+x2)/2+Math.sin(i*3.1+j)*s*.18,my=(y1+y2)/2+Math.cos(i*2.3+j)*s*.18;ctx.strokeStyle=colFn(i,j,alpha);ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(mx,my,x2,y2);ctx.stroke();}
      for(const i of this.waterIdx){const [x,y]=this.center(i);const r=this.areaWater.has(i)?s*.95:s*.42;ctx.fillStyle=colFn(i,i,alpha);ctx.beginPath();ctx.arc(x,y,r*(w/(s*.84)),0,6.28);ctx.fill();}};
    stroke(s*1.05,()=>'#e4d9bd',1);this.fillTris(ctx,()=>'#e4d9bd',.3);   // arena/orilla
    stroke(s*.84,()=>'#5b6b72',1);this.fillTris(ctx,()=>'#5b6b72',.12);     // sombra de orilla
  }
  mountain(ctx,x,y,s,i,el){const rnd=k=>hash(i,k);for(let k=0;k<3;k++){const px=x+(k-1)*s*.45+(rnd(k)-.5)*s*.3,py=y+s*.3+(rnd(k+3)-.5)*s*.3,hh=s*(.75+rnd(k+6)*.45),w=s*.55;
      ctx.fillStyle='#6d6a62';ctx.beginPath();ctx.moveTo(px-w,py);ctx.lineTo(px,py-hh);ctx.lineTo(px+w,py);ctx.closePath();ctx.fill();
      ctx.fillStyle='#4a4842';ctx.beginPath();ctx.moveTo(px,py-hh);ctx.lineTo(px+w,py);ctx.lineTo(px+w*.15,py);ctx.closePath();ctx.fill();
      ctx.fillStyle='#8c8980';ctx.beginPath();ctx.moveTo(px,py-hh);ctx.lineTo(px-w,py);ctx.lineTo(px-w*.3,py);ctx.closePath();ctx.fill();
      if(el>=2400){const sn=hh*.42;ctx.fillStyle='#f4f4f2';ctx.beginPath();ctx.moveTo(px,py-hh);ctx.lineTo(px+w*sn/hh,py-hh+sn);ctx.lineTo(px+w*sn/hh*.3,py-hh+sn*.8);ctx.lineTo(px-w*sn/hh*.2,py-hh+sn*1.1);ctx.lineTo(px-w*sn/hh,py-hh+sn);ctx.closePath();ctx.fill();}}}
  hill(ctx,x,y,r){ctx.fillStyle='#7f9a4e';ctx.beginPath();ctx.ellipse(x,y,r,r*.55,0,Math.PI,0);ctx.fill();ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x+r*.15,y,r*.85,r*.5,0,Math.PI*1.5,0);ctx.fill();ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.ellipse(x-r*.2,y,r*.6,r*.45,0,Math.PI,Math.PI*1.5);ctx.fill();}
  tree(ctx,x,y,r,conifer){ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(x+r*.3,y+r*.1,r*.9,r*.4,0,0,6.28);ctx.fill();ctx.fillStyle='#5a3a1a';ctx.fillRect(x-1,y-r*.2,2,r*.6);
    if(conifer){ctx.fillStyle='#2f6b3a';ctx.beginPath();ctx.moveTo(x,y-r*2.1);ctx.lineTo(x+r*.8,y);ctx.lineTo(x-r*.8,y);ctx.closePath();ctx.fill();ctx.fillStyle='#3f8a48';ctx.beginPath();ctx.moveTo(x,y-r*2.1);ctx.lineTo(x-r*.8,y);ctx.lineTo(x-r*.1,y);ctx.closePath();ctx.fill();}
    else{ctx.fillStyle='#3b7d3a';ctx.beginPath();ctx.arc(x,y-r*.9,r,0,6.28);ctx.fill();ctx.fillStyle='#55a048';ctx.beginPath();ctx.arc(x-r*.3,y-r*1.1,r*.6,0,6.28);ctx.fill();}}
  volcano(ctx,x,y,s,i,small){const w=small?s*.7:s*1.5,h=small?s*.6:s*1.6;const py=y+s*.5;
    ctx.fillStyle='#5a4a44';ctx.beginPath();ctx.moveTo(x-w,py);ctx.lineTo(x-w*.18,py-h);ctx.lineTo(x+w*.18,py-h);ctx.lineTo(x+w,py);ctx.closePath();ctx.fill();
    ctx.fillStyle='#3d322e';ctx.beginPath();ctx.moveTo(x+w*.18,py-h);ctx.lineTo(x+w,py);ctx.lineTo(x+w*.2,py);ctx.closePath();ctx.fill();
    if(!small){ctx.fillStyle='#efeeea';ctx.beginPath();ctx.moveTo(x-w*.18,py-h);ctx.lineTo(x+w*.18,py-h);ctx.lineTo(x+w*.42,py-h*.6);ctx.lineTo(x+w*.1,py-h*.65);ctx.lineTo(x-w*.2,py-h*.55);ctx.lineTo(x-w*.42,py-h*.6);ctx.closePath();ctx.fill();}
    ctx.fillStyle='rgba(255,150,40,.55)';ctx.beginPath();ctx.ellipse(x,py-h,w*.22,w*.09,0,0,6.28);ctx.fill();
    for(let k=0;k<5;k++){ctx.fillStyle='rgba(245,215,60,.8)';ctx.beginPath();ctx.ellipse(x+(hash(i,k)-.5)*w*1.4,py-hash(i,k+7)*h*.5,s*.07,s*.045,0,0,6.28);ctx.fill();}}
  // ---------- render dinámico ----------
  draw(state,dt){this.t+=dt;const ctx=this.ctx,W=this.cv.width,Hh=this.cv.height,s=this.size*this.zoom,d=this.d,t=this.t;if(W<2||Hh<2)return;
    const key=W+'x'+Hh+'@'+this.zoom.toFixed(3)+'/'+this.ox.toFixed(1)+','+this.oy.toFixed(1);if(!this.terrain||this.terrainKey!==key){this.buildTerrain();this.terrainKey=key;}
    ctx.drawImage(this.terrain,0,0);
    const hs=state?state.hexes:null;
    // agua: color por química (y dueño), con corriente animada
    ctx.lineCap='round';ctx.lineJoin='round';
    const colOf=i=>{const h=d.hexes[i];const st=hs?hs[i]:null;const eff=st&&st.eff?st.eff:h;let c=waterColor(eff);if(st&&st.owner)c=mix(c,hex2rgb(FBY[st.owner].tint),clamp(.08+.02*st.pop+.05*st.biofilm,0,.35));return c;};
    for(const [i,j] of this.links){const [x1,y1]=this.center(i),[x2,y2]=this.center(j);const mx=(x1+x2)/2+Math.sin(i*3.1+j)*s*.18,my=(y1+y2)/2+Math.cos(i*2.3+j)*s*.18;const g=ctx.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,css(colOf(i)));g.addColorStop(1,css(colOf(j)));ctx.strokeStyle=g;ctx.lineWidth=s*.62;ctx.beginPath();ctx.moveTo(x1,y1);ctx.quadraticCurveTo(mx,my,x2,y2);ctx.stroke();}
    this.fillTris(ctx,(i,j,k)=>css(mix(mix(colOf(i),colOf(j),.5),colOf(k),.33)),.06);
    for(const i of this.waterIdx){const [x,y]=this.center(i);const r=this.areaWater.has(i)?s*.72:s*.31;const c=colOf(i);const g=ctx.createRadialGradient(x,y,r*.2,x,y,r);g.addColorStop(0,css(shade(c,.85)));g.addColorStop(1,css(c));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,6.28);ctx.fill();}
    // corriente: destellos que avanzan por los enlaces
    ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=Math.max(1,s*.05);
    for(const [i,j] of this.links){const [x1,y1]=this.center(i),[x2,y2]=this.center(j);const down=d.hexes[i].down.includes(j);const a=down?[x1,y1]:[x2,y2],b=down?[x2,y2]:[x1,y1];for(let k=0;k<2;k++){const ph=((t*.35+k*.5+i*.11)%1);const px=a[0]+(b[0]-a[0])*ph,py=a[1]+(b[1]-a[1])*ph;const ux=(b[0]-a[0]),uy=(b[1]-a[1]);const L2=Math.hypot(ux,uy)||1;ctx.globalAlpha=.6*Math.sin(ph*Math.PI);ctx.beginPath();ctx.moveTo(px-uy/L2*s*.12,py+ux/L2*s*.12);ctx.quadraticCurveTo(px+ux/L2*s*.12,py+uy/L2*s*.12,px+uy/L2*s*.12,py-ux/L2*s*.12);ctx.stroke();}}
    ctx.globalAlpha=1;
    for(const i of this.waterIdx){const h=d.hexes[i];const st=hs?hs[i]:null;const eff=st&&st.eff?st.eff:h;const [x,y]=this.center(i);
      for(let k=0;k<3;k++){const a=.5+.5*Math.sin(t*3+k*2.1+i);ctx.fillStyle=`rgba(255,255,255,${a*.6})`;ctx.beginPath();ctx.arc(x+(hash(i,k)-.5)*s*.8,y+(hash(k,i)-.5)*s*.6,s*.03,0,6.28);ctx.fill();}
      const ph=eff.ph!==undefined?eff.ph:7,fe=eff.fe||0;
      if(ph<3.2&&(eff.so4>1500||h.t==='spring'||h.t==='crater')){ctx.strokeStyle='rgba(240,214,70,.7)';ctx.lineWidth=s*.07;ctx.setLineDash([s*.2,s*.15]);ctx.beginPath();ctx.arc(x,y,s*.4,0,6.28);ctx.stroke();ctx.setLineDash([]);}
      else if(fe>80){ctx.strokeStyle='rgba(200,100,30,.55)';ctx.lineWidth=s*.06;ctx.setLineDash([s*.25,s*.2]);ctx.beginPath();ctx.arc(x,y,s*.4,0,6.28);ctx.stroke();ctx.setLineDash([]);}
      if(h.t==='falls'){ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;for(let k=0;k<5;k++){const p2=((t*.9+k*.2)%1);ctx.beginPath();ctx.moveTo(x-s*.3+k*s*.15,y-s*.25+p2*s*.2);ctx.lineTo(x-s*.3+k*s*.15,y-s*.25+p2*s*.2+s*.25);ctx.stroke();}}
      const T=eff.T||12;
      if(T>30){for(let k=0;k<(T>45?6:3);k++){const p2=((t*.4+k*.37+i*.13)%1);ctx.fillStyle=`rgba(255,255,255,${.7*(1-p2)})`;ctx.beginPath();ctx.arc(x+Math.sin(k*2.3+i)*s*.35,y+s*.3-p2*s*.8,s*.035+p2*s*.03,0,6.28);ctx.fill();}}
      if(T>38||h.t==='crater')this.steam(ctx,x,y,s,t,i,.2);
      if(h.t==='made'){ctx.strokeStyle=css(hex2rgb(FBY[h.madeBy].color),.9);ctx.lineWidth=Math.max(2,s*.05);ctx.setLineDash([s*.1,s*.08]);ctx.beginPath();ctx.arc(x,y,s*.62,0,6.28);ctx.stroke();ctx.setLineDash([]);}
      if(st&&st.biofilm){ctx.strokeStyle=css(hex2rgb(FBY[st.owner].tint),.95);ctx.lineWidth=s*.06*st.biofilm;ctx.setLineDash([s*.15,s*.1]);ctx.lineDashOffset=-t*2;ctx.beginPath();ctx.arc(x,y,s*.52,0,6.28);ctx.stroke();ctx.setLineDash([]);}
    }
    // fumarolas humeando
    for(const h of d.hexes){if(h.t==='fumarole'){const [x,y]=this.center(h.i);this.steam(ctx,x,y-s*.1,s,t,h.i,.18);}}
    // fronteras de territorio (estilo Civ)
    if(hs){const edges={};for(const i of this.waterIdx){const st=hs[i];if(!st||!st.owner)continue;const f=st.owner;const v=this.verts(...this.center(i),s,.9);const nb=neighborsOf(d.hexes[i].c,d.hexes[i].r,this.cols,this.rows);
        for(let e=0;e<6;e++){const a=v[(e+5)%6],b=v[e];const ang=Math.PI/180*(60*e-60);const nx=d.hexes[i].c+0,ny=0;let same=false;for(const [nc,nr] of nb){const j=this.byCR[nc+','+nr];const [cx,cy]=this.center(j);const [hx,hy]=this.center(i);const ea=Math.atan2(cy-hy,cx-hx);const mx=(a[0]+b[0])/2-hx,my=(a[1]+b[1])/2-hy;const ma=Math.atan2(my,mx);let dd=Math.abs(ea-ma);if(dd>Math.PI)dd=2*Math.PI-dd;if(dd<.3&&hs[j]&&hs[j].owner===f)same=true;}
          if(!same)(edges[f]=edges[f]||[]).push([a,b]);}}
      for(const f in edges){ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=Math.max(3,s*.11);ctx.lineCap='round';ctx.beginPath();for(const [a,b] of edges[f]){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}ctx.stroke();ctx.strokeStyle=FBY[f].color;ctx.lineWidth=Math.max(2,s*.065);ctx.stroke();}}
    // tu territorio: brillo suave; tu casa: bandera
    if(hs&&state.me){const F=FBY[state.me];for(const i of this.waterIdx){const st=hs[i];if(!st||st.owner!==state.me)continue;const [x,y]=this.center(i);const g=ctx.createRadialGradient(x,y,s*.1,x,y,s*.95);g.addColorStop(0,css(hex2rgb(F.color),.22+.08*Math.sin(t*2)));g.addColorStop(1,css(hex2rgb(F.color),0));ctx.fillStyle=g;this.path(ctx,x,y,s,.95);ctx.fill();}
      const home=d.siteHex[F.home];if(home!==undefined){const [x,y]=this.center(home);const px=x+s*.6,top=y-s*1.75;ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px,y-s*.1);ctx.lineTo(px,top);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
        const wob=Math.sin(t*4)*s*.05;ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px+s*1.05,top+s*.28+wob);ctx.lineTo(px,top+s*.58);ctx.closePath();ctx.fillStyle=F.color;ctx.fill();
        ctx.lineWidth=4;ctx.strokeStyle='#111';ctx.setLineDash([]);ctx.stroke();ctx.strokeStyle='#fff';ctx.setLineDash([s*.14,s*.14]);ctx.lineDashOffset=-t*s*.6;ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#111';ctx.font=`bold ${Math.max(10,s*.26)|0}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(LANG==='en'?'YOU':'TÚ',px+s*.4,top+s*.29);}}
    // objetivos / hover / selección
    if(state&&state.targets){for(const j of state.targets){const [x,y]=this.center(j);this.path(ctx,x,y,s,.9);ctx.setLineDash([s*.18,s*.12]);ctx.lineDashOffset=-t*s*.5;ctx.strokeStyle=`rgba(255,255,255,${.7+.3*Math.sin(t*5)})`;ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([]);if(!(hs&&hs[j]&&hs[j].owner)){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font=`bold ${Math.max(12,s*.5)|0}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('+',x,y+1);}}}
    if(this.hover>=0&&!this.isLand(this.hover)){const [x,y]=this.center(this.hover);this.path(ctx,x,y,s,.96);ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=2;ctx.stroke();}
    if(this.sel>=0){const [x,y]=this.center(this.sel);this.path(ctx,x,y,s,.96);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();}
    // nombres de ríos
    ctx.textAlign='center';ctx.textBaseline='middle';
    if(s>22){ctx.font=`italic ${Math.max(10,s*.28)|0}px Georgia,serif`;const named={};for(const i of this.waterIdx){const h=d.hexes[i];if(!h.river||named[h.river]||h.site||h.river==='Laguna del Cráter')continue;named[h.river]=1;const same=this.waterIdx.filter(j=>d.hexes[j].river===h.river);const mid=same[Math.floor(same.length/2)];const [x,y]=this.center(mid);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(h.river,x+1,y-s*.5+1);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillText(h.river,x,y-s*.5);}}
    // población (fichas) y carteles de ciudad en sitios
    for(const i of this.waterIdx){const h=d.hexes[i];const st=hs?hs[i]:null;const [x,y]=this.center(i);
      if(h.site){const f=st&&st.owner?FBY[st.owner]:null;const label=h.site;ctx.font=`bold ${Math.max(9,s*.24)|0}px system-ui,sans-serif`;const tw=ctx.measureText(label).width;const bw=tw+s*.75,bh=s*.36;const bx=x-bw/2,by=y-s*.98;
        ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.roundRect(bx+2,by+2,bw,bh,bh/2);ctx.fill();
        ctx.fillStyle=f?'#1b2a44':'#2a2a2a';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh/2);ctx.fill();ctx.strokeStyle=f?f.color:'#777';ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle=f?f.color:'#555';ctx.beginPath();ctx.arc(bx+bh/2,by+bh/2,bh*.42,0,6.28);ctx.fill();
        ctx.fillStyle='#111';ctx.font=`bold ${Math.max(9,s*.22)|0}px system-ui,sans-serif`;ctx.fillText(st&&st.owner?Math.round(st.pop):'·',bx+bh/2,by+bh/2+1);
        ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(9,s*.24)|0}px system-ui,sans-serif`;ctx.textAlign='left';ctx.fillText(label,bx+bh*.95,by+bh/2+1);ctx.textAlign='center';
        ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(x-1,by+bh,2,s*.2);}
      if(st&&st.owner&&st.pop>0){const f=FBY[st.owner];const rr=s*.2;ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.arc(x+2,y+2,rr,0,6.28);ctx.fill();ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(x,y,rr,0,6.28);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#111';ctx.font=`bold ${Math.max(9,s*.3)|0}px system-ui,sans-serif`;ctx.fillText(Math.round(st.pop),x,y+1);}
      if(st&&st.shield>0){ctx.strokeStyle='rgba(120,220,255,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,s*.3,0,6.28);ctx.stroke();}
      if(st&&st.eDNA){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+s*.4,y-s*.32,s*.11,0,6.28);ctx.fill();ctx.fillStyle='#333';ctx.font=`bold ${Math.max(8,s*.16)|0}px system-ui,sans-serif`;ctx.fillText('ADN',x+s*.4,y-s*.31);}
    }
    // partículas
    for(let k=this.particles.length-1;k>=0;k--){const p=this.particles[k];p.x+=p.vx*s*.1;p.y+=p.vy*s*.1;p.life-=dt*.8;if(p.life<=0){this.particles.splice(k,1);continue;}
      ctx.globalAlpha=p.life;ctx.fillStyle=p.kind==='toxin'?'#c04bff':p.kind==='gift'?'#8fff9a':p.kind==='dna'?'#fff':p.kind==='colonize'?'#fff2a8':'#ff8a3a';ctx.beginPath();ctx.arc(p.x,p.y,s*.07,0,6.28);ctx.fill();ctx.globalAlpha=1;}
  }
  steam(ctx,x,y,s,t,i,k){for(let n=0;n<3;n++){const ph=((t*.25+n*.33+i*.07)%1);ctx.fillStyle=`rgba(240,240,240,${.18*(1-ph)})`;ctx.beginPath();ctx.arc(x+Math.sin(t*.8+n+i)*s*.25,y-ph*s*1.3-s*.1,s*(k+ph*.4),0,6.28);ctx.fill();}}
}
return {HexMapRenderer,waterColor,hexDist,neighborsOf,clamp,lerp};
})();
