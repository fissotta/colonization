# COLONIZATION: Guerra por el Agrio

Juego de estrategia por turnos (estilo *Civilization*, pero chico y rápido) en el que las comunidades microbianas
del sistema volcánico Caviahue‑Copahue luchan por dominar el río Agrio: colonizan, negocian, pelean y se defienden
usando conceptos biológicos reales (nicho ecológico, quimiolitoautotrofía, biofilm, c‑di‑GMP, vesículas de membrana
externa, transferencia horizontal de genes, ICE, quorum sensing, fagos/CRISPR, sintrofia) sobre datos reales.

## Cómo correrlo
- Mac / Linux: en esta carpeta `python3 tools/serve.py` (o `python3 -m http.server 8000`) y abre http://localhost:8000
- Windows: `python -m http.server 8000`
- GitHub: https://github.com/fissotta/colonization — GitHub Pages sirve la carpeta tal cual (hay `.nojekyll`).
- Funciona offline: todo es HTML + JS puro, sin dependencias.

## Modos
- **Aprender**: mapa chico (16×11), 15 turnos, rivales que no atacan, pistas de la asesora. Para la primera partida.
- **Rápida**: mapa mediano (23×16), 25 turnos, sin reloj.
- **Campaña**: mapa grande (32×22), 120 turnos, pausa y guardado automático cada turno **por usuario** (localStorage); exportable a .json desde el menú ☰.
- Victorias: dominación (40 % del río; 60 % en campaña), genética (los 8 poderes), simbiótica (2 sintrofias por 8/10 turnos) o puntaje al final (ecológica si no tienes guerras y quedan ≥ 4 facciones).
- Idioma: español por defecto, botón **English** en la portada o en el menú.

## Facciones (comunidades reales de los metagenomas de Copahue)
| Facción | Taxón | Casa | Rasgo |
|---|---|---|---|
| Imperio del Azufre | *Acidithiobacillus* (A. caldus, A. thiooxidans, A. ferrivorans) | RAS1 | oxida azufre, acidifica vecinos |
| Hijos del Fuego | *‘Igneacidithiobacillus copahuensis’* VAN18‑1ᵀ | VAN | 37–40 °C, pH 2,2–2,5; muy móvil; biofilm Pel; auxótrofo (Ser/Asn/His) |
| Liga del Hierro | *Leptospirillum* + *Ferroplasma* | VA1 | oxida Fe²⁺, aguanta pH < 1 |
| Los Recicladores | *Acidiphilium* + *Acidocella* | LC | heterótrofos, comensalismo, reducen Fe³⁺ |
| Constructores de Biofilm | *Ferrovum* | SA1 | biofilm barato y muy defensivo |
| República Neutra | *Limnohabitans* + *Polynucleobacter* + *Flavobacterium* | RJ | agua neutra, rápidos, mueren a pH < 5 |
| Los Nómades (IA) | *Sulfobacillus* + *Thiomonas* | VA2 | mixótrofos, endosporas |

## Mecánicas
- **Mapa**: tablero estilo Civilization VI (23×16 hexes en partida rápida, 32×22 en campaña; el tablero base de 16×11 se remuestrea) (terreno pintado continuo, montañas, bosques, ríos serpenteantes, fronteras de color, carteles de ciudad), 47 de agua, con la forma del sistema real:
  volcán y vertientes al noroeste, Agrio Superior, Jara, lago Caviahue, Agrio Inferior hasta el Salto, Puerta de Trolope y Loncopué,
  Chancho‑Có y las Mellizas. Cada hex de agua tiene pH, temperatura, Fe, SO₄ y O₂ reales (interpolados entre sitios de muestreo).
  El color del agua sale del pH y el hierro (rojo‑óxido en el Agrio, turquesa en el lago, azul en el Jara) y se tiñe
  con la facción que domina el sector.
- **Aptitud**: curva gaussiana de pH y temperatura respecto al óptimo de cada facción, con castigos por poco O₂, metales y sal.
- **Recursos**: energía (S, Fe o carbono orgánico), carbono (RuBisCO o materia orgánica) y nutrientes (N, P).
- **Turno**: 3 acciones (6 en el primer turno): colonizar/competir (clic en los hexes que brillan), biofilm (3 niveles), vesículas (enzimas, toxinas, ADN), adquirir un poder, cambiar de modo (Expandir/Defender) o **Preparar agua** (1 acción): crear hasta 3 casillas de agua en tierra pegada a tu territorio, con tu propia química (pH y temperatura óptimos); cualquiera puede colonizarlas, pero te favorecen a ti. Al hacer clic en un hex aparece un menú con lo que puedes hacer ahí.
- **Poderes**: 8 genes reales (escudo ácido, resistir calor, flagelos, biofilm Pel, CRISPR, toxinas, esporas, comer hierro); se consiguen por mutación, conjugación (vecino con el gen; ICE la abarata),
  transformación (ADN libre que queda al morir una población) o transducción (tras una tormenta de fagos).
- **Diplomacia**: sintrofia (alianza autótrofo + heterótrofo), paz, guerra, regalos; la IA tiene personalidad y frases.
- **Eventos** cada 4–5 turnos: erupción, deshielo, verano, fagos, expedición de muestreo, ceniza, sequía.
- **Sonido**: música procedural con Web Audio (un modo musical por facción, capas que se suman con cada era, tambores en guerra) y efectos.

## Estructura
- `index.html` — pantalla, HUD, estilos
- `data/copahue.js` — datos derivados de `copahue-v8/data/data.js` (muestras, metagenomas, DEM, ríos, fotos) + mapa de hexes
- `js/factions.js` — facciones, genes, eventos · `js/rules.js` — reglas · `js/ai.js` — IA · `js/map.js` — render
- `js/fx.js` — animaciones "lupa" (bacterias dividiéndose, peleando, biofilm, agua, vesículas) · `js/audio.js` — música y efectos · `js/game.js` — interfaz · `js/save.js` — guardado · `js/pedia.js`, `js/i18n.js`
- `tools/build_map.py` — regenera `data/copahue.js` desde `data.js` de la v8 (solo lectura)

## Fuentes
- Campañas de muestreo Copahue 2019–2020 (sonda multiparamétrica, iones, metagenomas de 11 sitios, DEM y fotos).
- Arisan D, Moya‑Beltrán A, Rojas‑Villalobos C, Issotta F, et al. (2024) *Acidithiobacillia class members originating at sites within the Pacific Ring of Fire and other tectonically active locations and description of the novel genus ‘Igneacidithiobacillus’*. Front. Microbiol. 15:1360268.
- Moya‑Beltrán A, et al. (2021) *Genomic evolution of the class Acidithiobacillia: deep‑branching Proteobacteria living in extreme acidic conditions*. ISME J 15:3221–3238.

Microbial Ecophysiology Lab (Fundación Ciencia & Vida). Versión 1.0 — octubre 2026.
