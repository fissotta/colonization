// COLONIZATION — efectos "lupa": zoom al hex con bacterias animadas (dividirse, pelear, biofilm, agua, vesículas)
'use strict';
const FX=(()=>{
const list=[];
function hex2rgb(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function css(c,a){return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a===undefined?1:a})`;}
function rnd(seed){let x=Math.sin(seed*9301+49297)*233280;return x-Math.floor(x);}
function play(kind,i,opts){list.push(Object.assign({kind,i,t:0,dur:kind==='attack'?2.4:kind==='fail'?1.4:1.9},opts||{}));}
function cell(ctx,x,y,ang,len,w,col,flag,t,seed){ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  if(flag){ctx.strokeStyle=css(col,.8);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-len/2,0);for(let k=1;k<=6;k++){ctx.lineTo(-len/2-k*w*.5,Math.sin(t*14+k*1.2+seed)*w*.35);}ctx.stroke();}
  ctx.fillStyle=css(col);ctx.beginPath();ctx.roundRect(-len/2,-w/2,len,w,w/2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.roundRect(-len/2+w*.2,-w/2+w*.15,len*.5,w*.25,w*.12);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-len/2,-w/2,len,w,w/2);ctx.stroke();ctx.restore();}
function draw(ctx,map,dt,W,H){for(let k=list.length-1;k>=0;k--){const f=list[k];f.t+=dt;if(f.t>f.dur){list.splice(k,1);continue;}
  const [cx,cy]=map.center(f.i);const p=f.t/f.dur;const R=Math.min(W,H)*.19;const grow=Math.min(1,f.t/.25),fade=p>.82?(1-p)/.18:1;const r=R*grow;
  ctx.save();ctx.globalAlpha=fade;
  // lupa: aro + fondo de agua
  ctx.beginPath();ctx.arc(cx,cy,r,0,6.28);ctx.save();ctx.clip();
  const wc=f.water||[60,150,170];const g=ctx.createRadialGradient(cx,cy,r*.1,cx,cy,r);g.addColorStop(0,css(wc.map(v=>v*1.15)));g.addColorStop(1,css(wc.map(v=>v*.7)));ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,2*r,2*r);
  for(let n=0;n<8;n++){const a=rnd(n+f.i)*6.28,d=rnd(n*3+1)*r*.9;ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d+Math.sin(f.t*2+n)*4,r*(.04+rnd(n*7)*.05),0,6.28);ctx.fill();}
  const col=hex2rgb(f.color||'#f2c230');const s=r*.11;const tt=f.t;
  if(f.kind==='colonize'){const gens=Math.min(3,Math.floor(tt/.45));const n=2*Math.pow(2,gens);const split=(tt%.45)/.45;
    for(let m=0;m<n;m++){const a=rnd(m*5+2)*6.28,d=(rnd(m*11+3)*.5+.25)*r*(n>8?1:.8);const x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;const len=s*(1.6+(m%2?split*.9:0));cell(ctx,x,y,a+rnd(m)*1.5+Math.sin(tt*3+m)*.15,len,s*.7,col,f.flag,tt,m);}
  }else if(f.kind==='fail'){for(let m=0;m<4;m++){const a=rnd(m*5+2)*6.28,d=(rnd(m*11+3)*.5+.2)*r;const x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;ctx.globalAlpha=fade*(1-p*.8);cell(ctx,x,y,a,s*1.4*(1-p*.5),s*.6*(1-p*.4),col,false,tt,m);ctx.globalAlpha=fade;}
    ctx.strokeStyle='rgba(255,80,60,.9)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-r*.35,cy-r*.35);ctx.lineTo(cx+r*.35,cy+r*.35);ctx.moveTo(cx+r*.35,cy-r*.35);ctx.lineTo(cx-r*.35,cy+r*.35);ctx.stroke();
  }else if(f.kind==='attack'){const col2=hex2rgb(f.color2||'#888');const adv=Math.min(1,tt/1.4);const win=f.won;
    for(let m=0;m<6;m++){const y=cy+(m-2.5)*s*1.5;const x=cx-r*.6+adv*r*(win?.55:.2)+Math.sin(tt*5+m)*3;cell(ctx,x,y,0,s*1.6,s*.7,col,f.flag,tt,m);
      const x2=cx+r*.6-adv*r*(win?.2:.55)-Math.sin(tt*5+m)*3;ctx.globalAlpha=fade*(win&&tt>1.5?Math.max(0,1-(tt-1.5)):1);cell(ctx,x2,y,Math.PI,s*1.6,s*.7,col2,false,tt,m+9);ctx.globalAlpha=fade;}
    for(let m=0;m<10;m++){const ph=(tt*1.5+m*.13)%1;const dir=win?1:-1;const x=cx-dir*r*.3+dir*ph*r*.6,y=cy+(rnd(m*3+7)-.5)*r*1.2;ctx.fillStyle=m%3?'rgba(200,80,255,.85)':'rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(x,y,r*.025,0,6.28);ctx.fill();}
    if(!win){for(let m=0;m<6;m++){const y=cy+(m-2.5)*s*1.5;const x=cx-r*.6+adv*r*.2;if(tt>1.5){ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1;for(let q=0;q<5;q++){const a=q*1.26+m;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*s*(tt-1.5)*2,y+Math.sin(a)*s*(tt-1.5)*2);ctx.stroke();}}}}
  }else if(f.kind==='biofilm'){const n=10;const lvl=f.level||1;ctx.fillStyle=css(col,.18+.08*Math.min(1,tt));ctx.beginPath();ctx.arc(cx,cy,r*.75*Math.min(1,tt/.9),0,6.28);ctx.fill();ctx.strokeStyle=css(col,.6);ctx.lineWidth=3;ctx.setLineDash([6,4]);ctx.beginPath();ctx.arc(cx,cy,r*.75*Math.min(1,tt/.9),0,6.28);ctx.stroke();ctx.setLineDash([]);
    for(let m=0;m<n;m++){const a=rnd(m*5+2)*6.28,d0=(rnd(m*11+3)*.6+.3)*r,d=d0*(1-.35*Math.min(1,tt/.9));cell(ctx,cx+Math.cos(a)*d,cy+Math.sin(a)*d,a+1.2,s*1.5,s*.65,col,false,tt,m);}
    for(let m=0;m<lvl*6;m++){const a=rnd(m*13+1)*6.28,d=rnd(m*17+5)*r*.7;ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,r*.03,0,6.28);ctx.fill();}
  }else if(f.kind==='prepare'){for(let q=0;q<4;q++){const ph=(tt*.7+q*.25)%1;ctx.strokeStyle=`rgba(255,255,255,${.6*(1-ph)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r*ph,0,6.28);ctx.stroke();}
    for(let m=0;m<6;m++){const ph=(tt*.8+m*.17)%1;ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.ellipse(cx+(rnd(m*3)-.5)*r*.8,cy-r*.9+ph*r*1.2,r*.025,r*.045,0,0,6.28);ctx.fill();}
    for(let m=0;m<3;m++){const a=rnd(m*5+2)*6.28,d=rnd(m*11+3)*r*.4;ctx.globalAlpha=fade*Math.min(1,Math.max(0,(tt-.8)));cell(ctx,cx+Math.cos(a)*d,cy+Math.sin(a)*d,a,s*1.5,s*.65,col,f.flag,tt,m);ctx.globalAlpha=fade;}
  }else if(f.kind==='omv'){for(let m=0;m<3;m++){cell(ctx,cx-r*.45,cy+(m-1)*s*1.6,0,s*1.6,s*.7,col,false,tt,m);}
    for(let m=0;m<12;m++){const ph=(tt*.9+m*.083)%1;const y=cy+(rnd(m*3+7)-.5)*r*.9;ctx.fillStyle=f.type==='toxin'?'rgba(200,80,255,.9)':f.type==='dna'?'rgba(255,255,255,.9)':'rgba(140,255,160,.9)';ctx.beginPath();ctx.arc(cx-r*.3+ph*r*1.1,y+Math.sin(ph*9+m)*6,r*.03,0,6.28);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1;ctx.stroke();}
  }
  ctx.restore();
  // aro de la lupa + mango
  ctx.strokeStyle='rgba(20,24,30,.9)';ctx.lineWidth=Math.max(4,r*.06);ctx.beginPath();ctx.arc(cx,cy,r,0,6.28);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=Math.max(2,r*.025);ctx.stroke();
  ctx.strokeStyle='rgba(20,24,30,.9)';ctx.lineWidth=Math.max(5,r*.08);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cx+r*.72,cy+r*.72);ctx.lineTo(cx+r*1.05,cy+r*1.05);ctx.stroke();
  // texto
  if(f.text){ctx.font=`bold ${Math.max(14,r*.16)|0}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(f.text).width+22;ctx.fillStyle='rgba(10,14,18,.9)';ctx.beginPath();ctx.roundRect(cx-tw/2,cy+r+10,tw,r*.26,8);ctx.fill();ctx.fillStyle=f.textColor||'#fff';ctx.fillText(f.text,cx,cy+r+10+r*.13);}
  ctx.restore();}}
return {play,draw,get active(){return list.length>0;}};
})();
