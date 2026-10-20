// COLONIZATION — tablero de hexágonos en pseudo‑3D (prismas con relieve, agua animada, vapor, azufre, bosques, nieve)
'use strict';
const HexMap=(()=>{
const SQ3=Math.sqrt(3),SY=.84; // SY: inclinación de cámara (aplasta los hexes para dar sensación 3D)
function oddrToCube(c,r){const x=c-((r-(r&1))>>1);const z=r;return [x,-x-z,z];}
function hexDist(a,b){const A=oddrToCube(a.c,a.r),B=oddrToCube(b.c,b.r);return Math.max(Math.abs(A[0]-B[0]),Math.abs(A[1]-B[1]),Math.abs(A[2]-B[2]));}
function neighborsOf(c,r,cols,rows){const odd=r&1;const cand=[[c-1,r],[c+1,r],[c-1+odd,r-1],[c+odd,r-1],[c-1+odd,r+1],[c+odd,r+1]];return cand.filter(([a,b])=>a>=0&&a<cols&&b>=0&&b<rows);}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
function hex2rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function css(c,a){return a===undefined?`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`:`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;}
function mix(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];}
function shade(c,k){return [c[0]*k,c[1]*k,c[2]*k];}
function hash(i,j){let h=(i*374761393+j*668265263)|0;h=(h^(h>>13))*1274126177;return ((h^(h>>16))>>>0)/4294967295;}
const C_CRATER=hex2rgb('#b5c9bd'),C_RUST=hex2rgb('#c94a1c'),C_RUST2=hex2rgb('#e07a2e'),C_ACID=hex2rgb('#2ec4bb'),C_MID=hex2rgb('#3fb391'),C_NEUT=hex2rgb('#2f8fe8'),C_HOT=hex2rgb('#9ac3d3');
function waterColor(h){const ph=h.ph!==undefined?h.ph:7,fe=h.fe||0;let c;
  if(ph<1.5)c=mix(C_CRATER,C_RUST,clamp((fe-50)/800,0,1)*.6);
  else if(ph<3.6){const k=clamp(Math.log10(fe+1)/3.1,0,1);c=k>.5?mix(C_RUST2,C_RUST,(k-.5)*2):mix(C_ACID,C_RUST2,k*2);}
  else if(ph<5.5){c=mix(mix(C_MID,C_RUST2,clamp(fe/40,0,1)*.5),C_NEUT,(ph-3.6)/1.9*.5);}
  else c=mix(C_MID,C_NEUT,clamp((ph-5.5)/1.5,0,1));
  if(h.t==='hot')c=mix(c,C_HOT,.5);return c;}
function landColor(el){let c;
  if(el<1500)c=mix(hex2rgb('#b9a263'),hex2rgb('#9fa05a'),(el-1200)/300);
  else if(el<2000)c=mix(hex2rgb('#8fa455'),hex2rgb('#6f9a4e'),(el-1500)/500);
  else if(el<2400)c=mix(hex2rgb('#7f9456'),hex2rgb('#8d8a7e'),(el-2000)/400);
  else if(el<2750)c=mix(hex2rgb('#8d8a7e'),hex2rgb('#b9b4ac'),(el-2400)/350);
  else c=mix(hex2rgb('#d9d8d4'),hex2rgb('#f6f5f2'),clamp((el-2750)/300,0,1));
  return c;}
class HexMapRenderer{
  constructor(data,canvas){this.d=data;this.cv=canvas;this.ctx=canvas.getContext('2d');this.cols=data.cols;this.rows=data.rows;this.size=40;this.zoom=1;this.ox=0;this.oy=0;
    this.hover=-1;this.sel=-1;this.particles=[];this.t=0;this.byCR={};data.hexes.forEach(h=>{this.byCR[h.c+','+h.r]=h.i;});
    this.waterIdx=data.hexes.filter(h=>!['land','mountain','fumarole'].includes(h.t)).map(h=>h.i);this.playable=this.waterIdx.slice();
    this.nbr=data.hexes.map(h=>neighborsOf(h.c,h.r,this.cols,this.rows).map(([a,b])=>this.byCR[a+','+b]));
    const els=data.elev;this.minEl=Math.min(...els);this.maxEl=Math.max(...els);
    this.H=data.hexes.map(h=>{const k=(data.elev[h.i]-this.minEl)/(this.maxEl-this.minEl);return .12+k*1.1;});
    for(const i of this.waterIdx){const h=data.hexes[i];const nb=this.nbr[i].filter(j=>this.isLand(j));const avg=nb.length?nb.reduce((a,j)=>a+this.H[j],0)/nb.length:this.H[i];this.H[i]=Math.max(.08,avg-.22);}
    this.fit();}
  isLand(i){const t=this.d.hexes[i].t;return t==='land'||t==='mountain'||t==='fumarole';}
  fit(){const W=this.cv.width,H=this.cv.height;const sx=W/((this.cols+.6)*SQ3),sy=H/((this.rows*1.5+1.6)*SY+1.4);this.size=Math.min(sx,sy)*.97;this.zoom=1;this.ox=(W-(this.cols+.5)*SQ3*this.size)/2;this.oy=(H-((this.rows*1.5+.5)*SY+1.3)*this.size)/2+this.size*1.1;}
  center(i){const h=this.d.hexes[i];const s=this.size*this.zoom;return [this.ox+s*SQ3*(h.c+.5+((h.r&1)?.5:0)),this.oy+s*(1+h.r*1.5)*SY];}
  top(i){const [x,y]=this.center(i);return [x,y-this.H[i]*this.size*this.zoom];}
  hexAt(px,py){const s=this.size*this.zoom;let best=-1,bd=1e9;for(const h of this.d.hexes){const [x,y]=this.top(h.i);const dx=(px-x),dy=(py-y)/SY;const d=dx*dx+dy*dy;if(d<bd){bd=d;best=h.i;}}return bd<=s*s*.95?best:-1;}
  verts(x,y,s,k){k=k||1;const v=[];for(let a=0;a<6;a++){const ang=Math.PI/180*(60*a-30);v.push([x+s*k*Math.cos(ang),y+s*k*Math.sin(ang)*SY]);}return v;}
  path(ctx,x,y,s,k){const v=this.verts(x,y,s,k);ctx.beginPath();v.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
  dist(i,j){return hexDist(this.d.hexes[i],this.d.hexes[j]);}
  hexesWithin(i,n){return this.waterIdx.filter(j=>j!==i&&this.dist(i,j)<=n);}
  spawn(i,kind,n){const [x,y]=this.top(i);for(let k=0;k<(n||6);k++)this.particles.push({x:x+(Math.random()-.5)*this.size*this.zoom,y:y+(Math.random()-.5)*this.size*this.zoom*.5,vx:(Math.random()-.5)*.4,vy:-.5-Math.random(),life:1,kind});}
  // ---------- render ----------
  draw(state,dt){this.t+=dt;const ctx=this.ctx,W=this.cv.width,Hh=this.cv.height,s=this.size*this.zoom,d=this.d,t=this.t;
    // cielo / fondo
    const g=ctx.createLinearGradient(0,0,0,Hh);g.addColorStop(0,'#101a26');g.addColorStop(1,'#060a0e');ctx.fillStyle=g;ctx.fillRect(0,0,W,Hh);
    const hs=state?state.hexes:null;
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){const i=this.byCR[c+','+r];const h=d.hexes[i];const [x,y]=this.center(i);const H=this.H[i]*s;const yt=y-H;
      const land=this.isLand(i);const st=hs?hs[i]:null;const eff=st&&st.eff?st.eff:h;
      let topc=land?landColor(d.elev[i]):waterColor(eff);
      if(h.t==='fumarole')topc=hex2rgb('#7a716a');
      if(!land&&st&&st.owner){topc=mix(topc,hex2rgb(FBY[st.owner].tint),clamp(.1+.025*st.pop+.06*st.biofilm,0,.42));}
      // laterales (prisma)
      const v=this.verts(x,yt,s,1.0);const side=land?shade(topc,.55):shade(mix(topc,[60,50,40],.5),.5);
      const faces=[[0,1,.62],[1,2,.5],[2,3,.72],[3,4,.86]];
      for(const [a,b,k] of faces){ctx.beginPath();ctx.moveTo(v[a][0],v[a][1]);ctx.lineTo(v[b][0],v[b][1]);ctx.lineTo(v[b][0],v[b][1]+H);ctx.lineTo(v[a][0],v[a][1]+H);ctx.closePath();ctx.fillStyle=css(shade(land?topc:[150,130,110],k));ctx.fill();}
      // cara superior
      const rip=land?0:.05*Math.sin(t*1.6+c*.9+r*1.3)+.03*Math.sin(t*2.7+c*2.1-r*.7);
      this.path(ctx,x,yt,s,1.0);ctx.fillStyle=css(shade(topc,1+rip));ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1;ctx.stroke();
      if(!land&&st&&st.owner){this.path(ctx,x,yt,s,.9);ctx.strokeStyle=FBY[st.owner].color;ctx.lineWidth=Math.max(2,s*.07);ctx.stroke();}
      if(land)this.decorLand(ctx,i,h,x,yt,s,t);else this.decorWater(ctx,i,h,eff,st,x,yt,s,t);
    }
    // flechas de corriente
    ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1.5;
    for(const i of this.waterIdx){const h=d.hexes[i];for(const j of h.down){const [x1,y1]=this.top(i),[x2,y2]=this.top(j);const dx=x2-x1,dy=y2-y1,L2=Math.hypot(dx,dy)||1;const ux=dx/L2,uy=dy/L2;const ph=(t*.5+i*.13)%1;const px=x1+dx*(.25+ph*.5),py=y1+dy*(.25+ph*.5);ctx.beginPath();ctx.moveTo(px-ux*s*.16-uy*s*.09,py-uy*s*.16+ux*s*.09);ctx.lineTo(px,py);ctx.lineTo(px-ux*s*.16+uy*s*.09,py-uy*s*.16-ux*s*.09);ctx.stroke();}}
    // objetivos / selección
    if(state&&state.targets){for(const j of state.targets){const [x,y]=this.top(j);this.path(ctx,x,y,s,.92);ctx.strokeStyle=`rgba(255,255,255,${.55+.4*Math.sin(t*5)})`;ctx.lineWidth=3;ctx.stroke();}}
    if(this.hover>=0&&!this.isLand(this.hover)){const [x,y]=this.top(this.hover);this.path(ctx,x,y,s,1);ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.stroke();}
    if(this.sel>=0){const [x,y]=this.top(this.sel);this.path(ctx,x,y,s,1);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();}
    // etiquetas de sitios y ríos
    ctx.textAlign='center';ctx.textBaseline='middle';
    if(s>22){ctx.font=`italic ${Math.max(10,s*.3)|0}px Georgia,serif`;const named={};for(const i of this.waterIdx){const h=d.hexes[i];if(!h.river||named[h.river]||h.site||h.river==='Laguna del Cráter')continue;named[h.river]=1;const same=this.waterIdx.filter(j=>d.hexes[j].river===h.river);const mid=same[Math.floor(same.length/2)];const [x,y]=this.top(mid);ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillText(h.river,x+1,y-s*.55+1);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillText(h.river,x,y-s*.55);}}
    ctx.font=`bold ${Math.max(9,s*.26)|0}px system-ui,sans-serif`;
    for(const code in d.siteHex){const i=d.siteHex[code];const [x,y]=this.top(i);const w=ctx.measureText(code).width+8;ctx.fillStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.roundRect(x-w/2,y+s*.42,w,s*.3,4);ctx.fill();ctx.fillStyle='#ffe28a';ctx.fillText(code,x,y+s*.57);}
    // partículas
    for(let k=this.particles.length-1;k>=0;k--){const p=this.particles[k];p.x+=p.vx*s*.1;p.y+=p.vy*s*.1;p.life-=dt*.8;if(p.life<=0){this.particles.splice(k,1);continue;}
      ctx.globalAlpha=p.life;ctx.fillStyle=p.kind==='toxin'?'#c04bff':p.kind==='gift'?'#8fff9a':p.kind==='dna'?'#fff':p.kind==='colonize'?'#fff2a8':'#ff8a3a';ctx.beginPath();ctx.arc(p.x,p.y,s*.07,0,6.28);ctx.fill();ctx.globalAlpha=1;}
  }
  decorLand(ctx,i,h,x,y,s,t){const el=this.d.elev[i];
    if(h.t==='fumarole'){for(let k=0;k<5;k++){const a=k*1.26+i;ctx.fillStyle='rgba(245,215,60,.85)';ctx.beginPath();ctx.ellipse(x+Math.cos(a)*s*.45,y+Math.sin(a)*s*.45*SY,s*.1,s*.07,0,0,6.28);ctx.fill();}
      ctx.fillStyle='rgba(255,120,40,.35)';ctx.beginPath();ctx.ellipse(x,y,s*.22,s*.15,0,0,6.28);ctx.fill();this.steam(ctx,x,y,s,t,i,.22);return;}
    if(el>=2750){ctx.fillStyle='rgba(255,255,255,.55)';this.path(ctx,x,y,s,.6);ctx.fill();}
    else if(el>=2400){for(let k=0;k<4;k++){const a=hash(i,k)*6.28,rr=hash(k,i)*s*.5;ctx.fillStyle='rgba(70,65,60,.5)';ctx.beginPath();ctx.ellipse(x+Math.cos(a)*rr,y+Math.sin(a)*rr*SY,s*.09,s*.06,0,0,6.28);ctx.fill();}}
    else if(el>=1700&&el<2300){const nT=hash(i,77)>.5?6:hash(i,77)>.25?3:0;for(let k=0;k<nT;k++){const a=hash(i,k+9)*6.28,rr=hash(k+9,i)*s*.55;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*SY;const hgt=s*(.18+hash(i,k+3)*.12);
        ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(px+2,py+2,s*.09,s*.05,0,0,6.28);ctx.fill();
        ctx.fillStyle=k%2?'#2f6b3a':'#3b7d44';ctx.beginPath();ctx.moveTo(px,py-hgt);ctx.lineTo(px+s*.09,py);ctx.lineTo(px-s*.09,py);ctx.closePath();ctx.fill();ctx.fillStyle='#5a3a1a';ctx.fillRect(px-1,py,2,s*.05);}}
    else if(el<1700){for(let k=0;k<5;k++){const a=hash(i,k+21)*6.28,rr=hash(k+21,i)*s*.55;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*SY;ctx.strokeStyle='rgba(120,110,50,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px-3,py);ctx.lineTo(px,py-s*.1);ctx.lineTo(px+3,py);ctx.stroke();}}
  }
  steam(ctx,x,y,s,t,i,k){for(let n=0;n<3;n++){const ph=((t*.25+n*.33+i*.07)%1);ctx.fillStyle=`rgba(240,240,240,${.16*(1-ph)})`;ctx.beginPath();ctx.ellipse(x+Math.sin(t*.8+n+i)*s*.25,y-ph*s*1.5-s*.1,s*(k+ph*.4),s*(k+ph*.4)*.8,0,0,6.28);ctx.fill();}}
  decorWater(ctx,i,h,eff,st,x,y,s,t){
    ctx.save();this.path(ctx,x,y,s,.98);ctx.clip();
    // olas
    ctx.globalAlpha=.22;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(1,s*.05);
    for(let k=0;k<3;k++){const ph=((t*.45+k*.33+i*.1)%1);const yy=y-s*.8*SY+ph*s*1.6*SY;ctx.beginPath();ctx.moveTo(x-s,yy+Math.sin(t+k)*s*.08);ctx.quadraticCurveTo(x-s*.4,yy-s*.12,x,yy+Math.sin(t*1.4+k)*s*.06);ctx.quadraticCurveTo(x+s*.4,yy+s*.12,x+s,yy);ctx.stroke();}
    // destellos
    ctx.globalAlpha=1;for(let k=0;k<4;k++){const a=.5+.5*Math.sin(t*3+k*2.1+i);ctx.fillStyle=`rgba(255,255,255,${a*.55})`;ctx.beginPath();ctx.arc(x+(hash(i,k)-.5)*s*1.2,y+(hash(k,i)-.5)*s*.9*SY,s*.035,0,6.28);ctx.fill();}
    // espuma en orillas
    const v=this.verts(x,y,s,.98);const nb=neighborsOf(h.c,h.r,this.cols,this.rows);
    ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=s*.08;ctx.setLineDash([s*.15,s*.1]);ctx.lineDashOffset=-t*s*.4;
    const edgeNb=[[5,0,1,0],[0,1,1,1],[1,2,0,1],[2,3,-1,1],[3,4,-1,0],[4,5,-1,-1]];
    for(const [a,b] of [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]]){const mx=(v[a][0]+v[b][0])/2-x,my=(v[a][1]+v[b][1])/2-y;let landSide=false;for(const [nc,nr] of nb){const j=this.byCR[nc+','+nr];const [cx,cy]=this.center(j);const [hx,hy]=this.center(i);const dx=cx-hx,dy=cy-hy;if(dx*mx+dy*my>0&&Math.abs(Math.atan2(dy,dx)-Math.atan2(my,mx))<.6&&this.isLand(j))landSide=true;}
      if(landSide){ctx.beginPath();ctx.moveTo(v[a][0],v[a][1]);ctx.lineTo(v[b][0],v[b][1]);ctx.stroke();}}
    ctx.setLineDash([]);
    // costra de azufre / ocre de hierro
    const ph=eff.ph!==undefined?eff.ph:7,fe=eff.fe||0;
    if(ph<3.2&&(eff.so4>1500||h.t==='spring'||h.t==='crater')){ctx.strokeStyle='rgba(240,214,70,.6)';ctx.lineWidth=s*.14;ctx.setLineDash([s*.3,s*.2]);this.path(ctx,x,y,s,.9);ctx.stroke();ctx.setLineDash([]);}
    else if(fe>80){ctx.strokeStyle='rgba(215,110,40,.55)';ctx.lineWidth=s*.12;ctx.setLineDash([s*.4,s*.25]);this.path(ctx,x,y,s,.9);ctx.stroke();ctx.setLineDash([]);}
    if(h.t==='falls'){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;for(let k=0;k<5;k++){const ph2=((t*.9+k*.2)%1);ctx.beginPath();ctx.moveTo(x-s*.4+k*s*.2,y-s*.5*SY+ph2*s*.3);ctx.lineTo(x-s*.4+k*s*.2,y-s*.5*SY+ph2*s*.3+s*.35);ctx.stroke();}}
    const T=eff.T||12;
    if(T>30){for(let k=0;k<(T>45?6:3);k++){const ph2=((t*.4+k*.37+i*.13)%1);ctx.fillStyle=`rgba(255,255,255,${.6*(1-ph2)})`;ctx.beginPath();ctx.arc(x+Math.sin(k*2.3+i)*s*.5,y+s*.5*SY-ph2*s*1.1,s*.04+ph2*s*.04,0,6.28);ctx.fill();}}
    // biofilm
    if(st&&st.biofilm){ctx.strokeStyle=css(hex2rgb(FBY[st.owner].tint),.9);ctx.lineWidth=s*.08*st.biofilm;ctx.setLineDash([s*.2,s*.12]);ctx.lineDashOffset=-t*2;this.path(ctx,x,y,s,.75);ctx.stroke();ctx.setLineDash([]);}
    ctx.restore();
    if(T>38)this.steam(ctx,x,y,s,t,i,.25);
    // población
    if(st&&st.owner&&st.pop>0){const f=FBY[st.owner];const rr=s*.23;ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(x+2,y+2,rr,rr*.9,0,0,6.28);ctx.fill();ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(x,y,rr,0,6.28);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#111';ctx.font=`bold ${Math.max(10,s*.36)|0}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.round(st.pop),x,y+1);
      }
    if(st&&st.shield>0){ctx.strokeStyle='rgba(120,220,255,.9)';ctx.lineWidth=2;this.path(ctx,x,y,s,.62);ctx.stroke();}
    if(st&&st.eDNA){ctx.font=`${Math.max(10,s*.4)|0}px serif`;ctx.textAlign='center';ctx.fillText('🧬',x+s*.5,y-s*.45);}
  }
}
return {HexMapRenderer,waterColor,hexDist,neighborsOf,clamp,lerp};
})();
