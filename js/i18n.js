'use strict';
const I18N={
 es:{
  title:'COLONIZATION',subtitle:'Guerra por el Agrio',tagline:'Las comunidades microbianas de Copahue luchan por el río',
  play:'Jugar',quick:'Partida rápida',quickDesc:'25 turnos · ~30 min · reloj por turno',campaign:'Campaña',campaignDesc:'120 turnos · pausa y guardado · sin reloj',
  continue:'Continuar partida',newGame:'Nueva partida',player:'Jugador/a',chooseFaction:'Elige tu comunidad',start:'¡A colonizar!',
  turn:'Turno',endTurn:'Terminar turno',actions:'Acciones',energy:'Energía',carbon:'Carbono',nutrients:'Nutrientes',pop:'Población',
  colonize:'Colonizar',attack:'Competir',biofilm:'Biofilm',omv:'Vesículas',genes:'Poderes',diplomacy:'Alianzas',pedia:'Pedia',menu:'Menú',
  cdg:'c-di-GMP',cdgHigh:'🛡 Modo Defender (biofilm, +defensa, −éxito al colonizar)',cdgLow:'🏃 Modo Expandir (+alcance, +éxito, sin biofilm)',cdgSwitch:'Cambio de modo: cuesta 1 acción y vale desde el próximo turno',
  save:'Guardar',load:'Cargar',pause:'Pausa',resume:'Seguir',quit:'Salir al menú',lang:'English',sound:'Sonido',music:'Música',help:'Ayuda',
  selectHex:'Selecciona un hex de agua',yours:'tuyo',empty:'sin colonizar',owner:'Dominado por',ph:'pH',temp:'Temp.',fe:'Fe',so4:'SO₄',o2:'O₂ dis.',ec:'Conduct.',
  fitness:'Aptitud aquí',biofilmLvl:['planctónico','biofilm joven','biofilm',' biofilm maduro'],
  site:'Sitio de muestreo',photo:'Foto real',metagenome:'Metagenoma',reads:'lecturas',shannon:'Shannon',mags:'MAGs',
  sendOMV:'Enviar vesículas',omvEnzyme:'Enzimas / sideróforos (regalo)',omvToxin:'Toxinas (ataque a distancia)',omvDNA:'ADN (gen o señuelo anti‑fago)',
  propose:'Proponer',syntrophy:'Sintrofia (alianza)',peace:'Paz',war:'Declarar guerra',gift:'Regalo',relation:'Relación',allied:'Aliados',atWar:'En guerra',neutral:'Neutral',
  acquire:'Adquirir',via:'vía',mutation:'mutación',conjugation:'conjugación',transformation:'transformación',transduction:'transducción',owned:'adquirido',
  victory:'¡Victoria!',defeat:'Derrota',gameOver:'Fin de la partida',score:'Puntaje',domination:'Dominación del río',ecological:'Victoria ecológica',genetic:'Victoria genética',symbiotic:'Victoria simbiótica',
  learned:'Lo que aprendiste',realMap:'Mapa real de abundancias',yourMap:'Tu mapa final',
  noActions:'No te quedan acciones este turno',notEnough:'Recursos insuficientes',tooFar:'Demasiado lejos',needPop:'Necesitas población ≥ 3 en el hex de origen',
  success:'¡Colonizado!',fail:'La colonización fracasó',won:'¡Ganaste la competencia!',lost:'Perdiste la competencia',
  timer:'Tiempo del turno',autoEnd:'Turno terminado automáticamente',
  adviser:'Asesora científica',users:'Usuarios en este equipo',newUser:'Nuevo usuario',slot:'Ranura',empty2:'vacía',
  prepTitle:'Preparar agua',confirm:'Confirmar',oncePerTurn:'Solo una vez por turno',eraNames:['Era planctónica','Era del biofilm','Era genómica','Era simbiótica'],
 },
 en:{
  title:'COLONIZATION',subtitle:'War for the Agrio',tagline:'Copahue’s microbial communities fight for the river',
  play:'Play',quick:'Quick game',quickDesc:'25 turns · ~30 min · turn timer',campaign:'Campaign',campaignDesc:'120 turns · pause & save · no timer',
  continue:'Continue game',newGame:'New game',player:'Player',chooseFaction:'Choose your community',start:'Colonize!',
  turn:'Turn',endTurn:'End turn',actions:'Actions',energy:'Energy',carbon:'Carbon',nutrients:'Nutrients',pop:'Population',
  colonize:'Colonize',attack:'Compete',biofilm:'Biofilm',omv:'Vesicles',genes:'Powers',diplomacy:'Alliances',pedia:'Pedia',menu:'Menu',
  cdg:'c-di-GMP',cdgHigh:'🛡 Defend mode (biofilm, +defence, −colonize success)',cdgLow:'🏃 Expand mode (+range, +success, no biofilm)',cdgSwitch:'Mode switch: costs 1 action, applies next turn',
  save:'Save',load:'Load',pause:'Pause',resume:'Resume',quit:'Quit to menu',lang:'Español',sound:'Sound',music:'Music',help:'Help',
  selectHex:'Select a water hex',yours:'yours',empty:'uncolonized',owner:'Dominated by',ph:'pH',temp:'Temp.',fe:'Fe',so4:'SO₄',o2:'Diss. O₂',ec:'Conduct.',
  fitness:'Fitness here',biofilmLvl:['planktonic','young biofilm','biofilm','mature biofilm'],
  site:'Sampling site',photo:'Real photo',metagenome:'Metagenome',reads:'reads',shannon:'Shannon',mags:'MAGs',
  sendOMV:'Send vesicles',omvEnzyme:'Enzymes / siderophores (gift)',omvToxin:'Toxins (ranged attack)',omvDNA:'DNA (gene or anti‑phage decoy)',
  propose:'Propose',syntrophy:'Syntrophy (alliance)',peace:'Peace',war:'Declare war',gift:'Gift',relation:'Relation',allied:'Allied',atWar:'At war',neutral:'Neutral',
  acquire:'Acquire',via:'via',mutation:'mutation',conjugation:'conjugation',transformation:'transformation',transduction:'transduction',owned:'acquired',
  victory:'Victory!',defeat:'Defeat',gameOver:'Game over',score:'Score',domination:'River domination',ecological:'Ecological victory',genetic:'Genetic victory',symbiotic:'Symbiotic victory',
  learned:'What you learned',realMap:'Real abundance map',yourMap:'Your final map',
  noActions:'No actions left this turn',notEnough:'Not enough resources',tooFar:'Too far',needPop:'Need population ≥ 3 in the origin hex',
  success:'Colonized!',fail:'Colonization failed',won:'You won the competition!',lost:'You lost the competition',
  timer:'Turn timer',autoEnd:'Turn ended automatically',
  adviser:'Science adviser',users:'Users on this computer',newUser:'New user',slot:'Slot',empty2:'empty',
  prepTitle:'Prepare water',confirm:'Confirm',oncePerTurn:'Only once per turn',eraNames:['Planktonic era','Biofilm era','Genomic era','Symbiotic era'],
 }
};
let LANG='es';
try{LANG=localStorage.getItem('colonization.lang')||'es';}catch(_){}
function T(k){return (I18N[LANG]&&I18N[LANG][k]!==undefined)?I18N[LANG][k]:(I18N.es[k]!==undefined?I18N.es[k]:k);}
function L(obj){return obj?(obj[LANG]||obj.es||obj):'';}
function setLang(l){LANG=l;try{localStorage.setItem('colonization.lang',l);}catch(_){}}
