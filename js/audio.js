// COLONIZATION — música procedural (Web Audio) al estilo Civ: tema por facción que crece con cada era, y efectos
'use strict';
const Audio_=(()=>{
let ctx=null,master=null,musicGain=null,sfxGain=null,on=true,musicOn=true,started=false;
let state={faction:'acid',era:0,war:false,tempo:76};
const SCALES={ // modos por facción
  acid:[0,2,3,5,7,8,10],   // eólico
  ico:[0,1,4,5,7,8,10],    // frigio dominante (fuego)
  iron:[0,2,3,5,7,9,10],   // dórico
  recy:[0,2,4,5,7,9,11],   // jónico
  ferv:[0,2,4,7,9],        // pentatónica
  neut:[0,2,4,6,7,9,11],   // lidio
  noma:[0,2,3,6,7,8,11],   // húngaro
};
const ROOTS={acid:48,ico:50,iron:45,recy:53,ferv:48,neut:55,noma:50};
const MOTIFS={acid:[0,4,2,4,0,-1,2,0],ico:[0,3,5,7,5,3,0,-2],iron:[0,0,2,0,4,2,0,-3],recy:[2,4,2,0,4,6,4,2],ferv:[0,2,1,0,2,4,2,1],neut:[4,2,0,2,4,6,4,2],noma:[0,1,3,1,0,-2,0,1]};
function init(){if(ctx)return;ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.8;master.connect(ctx.destination);
  musicGain=ctx.createGain();musicGain.gain.value=.35;musicGain.connect(master);sfxGain=ctx.createGain();sfxGain.gain.value=.5;sfxGain.connect(master);}
function resume(){if(!ctx)init();if(ctx.state==='suspended')ctx.resume();if(!started){started=true;schedule();}}
function midi(n){return 440*Math.pow(2,(n-69)/12);}
function deg(scale,root,d,oct){const L=scale.length;let o=Math.floor(d/L);let k=d-o*L;if(k<0){k+=L;o--;}return root+scale[k]+12*(o+(oct||0));}
// --- synth voices ---
function tone(type,freq,t,dur,vol,dest,attack,release,detune){const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;if(detune)o.detune.value=detune;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+(attack||.02));g.gain.setValueAtTime(vol,t+Math.max(attack||.02,dur-(release||.1)));g.gain.linearRampToValueAtTime(0,t+dur);o.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.02);}
function noise(t,dur,vol,dest,hp){const n=ctx.sampleRate*dur;const b=ctx.createBuffer(1,n,ctx.sampleRate);const d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;const s=ctx.createBufferSource();s.buffer=b;const f=ctx.createBiquadFilter();f.type=hp?'highpass':'lowpass';f.frequency.value=hp||800;const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(dest);s.start(t);s.stop(t+dur);}
// --- music scheduler ---
let nextBar=0,bar=0;
function schedule(){if(!ctx)return;const now=ctx.currentTime;if(nextBar<now)nextBar=now+.05;
  while(nextBar<now+1.2){if(musicOn&&on)playBar(nextBar,bar);const tempo=state.war?state.tempo*1.25:state.tempo;nextBar+=4*60/tempo;bar++;}
  setTimeout(schedule,400);}
function playBar(t,b){const sc=state.war?[0,1,3,5,7,8,10]:SCALES[state.faction]||SCALES.acid;const root=ROOTS[state.faction]||48;const mot=MOTIFS[state.faction]||MOTIFS.acid;const beat=(state.war?state.tempo*1.25:state.tempo);const q=60/beat;const era=state.era;
  const prog=[0,3,4,5,2,3,0,4];const chordRoot=prog[b%8];
  // pad (always)
  const padDur=4*q;[0,2,4].forEach((k,i)=>{tone('triangle',midi(deg(sc,root,chordRoot+k,0)),t,padDur,.09-i*.015,musicGain,.8,1.2,i*4);tone('sine',midi(deg(sc,root,chordRoot+k,1)),t,padDur,.03,musicGain,1,1);});
  // melody
  for(let i=0;i<8;i++){if(era===0&&i%2)continue;const d=mot[(i+b*2)%mot.length]+chordRoot;const f=midi(deg(sc,root,d,2));const v=.11+(era>=2?.03:0);tone(era>=2?'sawtooth':'triangle',f,t+i*q/2,q/2*(i%4===3?1.8:.9),v,musicGain,.02,.08);if(era>=3)tone('sine',f*2.003,t+i*q/2,q/2*.8,.04,musicGain,.05,.1);}
  // bass + percussion from era 1
  if(era>=1||state.war){for(let i=0;i<4;i++){tone('sine',midi(deg(sc,root,chordRoot,-1)),t+i*q,q*.7,.16,musicGain,.01,.15);if(i%2===1)noise(t+i*q,.12,.08,musicGain,4000);}
    noise(t,.25,.14,musicGain,0);noise(t+2*q,.25,.11,musicGain,0);}
  // arpeggio from era 2
  if(era>=2){for(let i=0;i<16;i++){const d=chordRoot+[0,2,4,7][i%4];tone('square',midi(deg(sc,root,d,2)),t+i*q/4,q/4*.6,.03,musicGain,.005,.05);}}
  // strings swell era 3
  if(era>=3){[0,2,4,6].forEach((k,i)=>{tone('sawtooth',midi(deg(sc,root,chordRoot+k,1)),t,padDur,.035,musicGain,1.5,1.5,(i-1.5)*8);});}
  // war drums
  if(state.war){for(let i=0;i<8;i++){noise(t+i*q/2,.18,i%2?.07:.16,musicGain,0);tone('sine',55,t+i*q/2,.2,i%4===0?.3:.12,musicGain,.005,.15);}}
}
function setMusic(o){state=Object.assign(state,o);}
// --- SFX ---
function sfx(name){if(!on||!ctx)return;const t=ctx.currentTime;switch(name){
  case 'click':tone('square',880,t,.04,.08,sfxGain,.002,.02);break;
  case 'bubble':tone('sine',300,t,.12,.12,sfxGain,.01,.05);{const o=ctx.createOscillator();o.frequency.setValueAtTime(300,t);o.frequency.exponentialRampToValueAtTime(900,t+.12);const g=ctx.createGain();g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(sfxGain);o.start(t);o.stop(t+.16);}break;
  case 'colonize':tone('triangle',523,t,.15,.2,sfxGain);tone('triangle',784,t+.12,.25,.2,sfxGain);tone('sine',1046,t+.24,.4,.15,sfxGain);break;
  case 'fail':{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(400,t);o.frequency.exponentialRampToValueAtTime(90,t+.4);const g=ctx.createGain();g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.connect(g);g.connect(sfxGain);o.start(t);o.stop(t+.5);}break;
  case 'battle':noise(t,.35,.35,sfxGain,0);tone('sine',70,t,.35,.4,sfxGain,.005,.2);tone('square',140,t+.05,.15,.1,sfxGain);break;
  case 'win':[523,659,784,1046].forEach((f,i)=>tone('triangle',f,t+i*.09,.35,.2,sfxGain));break;
  case 'gene':[440,554,659,880,1108].forEach((f,i)=>tone('sine',f,t+i*.06,.25,.15,sfxGain));break;
  case 'biofilm':tone('triangle',220,t,.3,.2,sfxGain,.05,.2);tone('triangle',330,t+.15,.4,.15,sfxGain,.05,.3);noise(t,.3,.08,sfxGain,0);break;
  case 'omv':noise(t,.5,.2,sfxGain,1500);{const o=ctx.createOscillator();o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(1200,t+.4);const g=ctx.createGain();g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);o.connect(g);g.connect(sfxGain);o.start(t);o.stop(t+.5);}break;
  case 'event':tone('sine',110,t,2.5,.35,sfxGain,.01,2);tone('sine',165,t,2.2,.15,sfxGain,.01,2);noise(t,1.2,.12,sfxGain,0);break;
  case 'turn':tone('sine',180,t,.25,.25,sfxGain,.005,.2);tone('sine',120,t+.12,.3,.2,sfxGain,.005,.25);break;
  case 'diplo':[660,880].forEach((f,i)=>tone('sine',f,t+i*.12,.3,.15,sfxGain));break;
  case 'war':tone('sawtooth',98,t,.8,.25,sfxGain,.01,.5);tone('sawtooth',104,t,.8,.2,sfxGain,.01,.5);noise(t,.6,.2,sfxGain,0);break;
  case 'eruption':noise(t,2.5,.5,sfxGain,0);tone('sine',40,t,2.5,.6,sfxGain,.05,2);break;
  case 'fanfare':[392,523,659,784,1046,1318].forEach((f,i)=>{tone('sawtooth',f,t+i*.13,.5,.12,sfxGain,.01,.2);tone('triangle',f,t+i*.13,.6,.15,sfxGain);});break;
 }}
function toggleSound(){on=!on;if(master)master.gain.value=on?.8:0;return on;}
function toggleMusic(){musicOn=!musicOn;return musicOn;}
return {init,resume,sfx,setMusic,toggleSound,toggleMusic,get on(){return on;},get musicOn(){return musicOn;}};
})();
