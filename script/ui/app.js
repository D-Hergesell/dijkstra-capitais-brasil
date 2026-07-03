// ===== CAMADA DE APRESENTAÇÃO (UI) =====
// Orquestra as camadas de dados e serviço e renderiza a interface.

import { seed } from '../data/capitaisRepository.js';
import { buscarCaminhoMaisBarato, detalharGasto } from '../service/rotaService.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const brl = (n) =>
  'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let GRAFO = null;

// ---- Sprite do carro (pixel-art em divs) ----
const carHTML = () => `
  <img class="sprite" src="assets/car.png" alt="carro" draggable="false">
  <div class="smoke"><span></span><span></span><span></span><span></span></div>`;

const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Tela inicial: carro cruza e a "TV" desliga/liga revelando o menu ----
function iniciarJogo() {
  const start = $('startScreen');
  const car = $('startCar');
  if (start.classList.contains('launching')) return;
  start.classList.remove('tvon-start');
  car.classList.add('rolling');
  start.classList.add('launching');
  audio.ficha();
  audio.motor(1.5);

  // 1) carro cruza a tela (~1.5s); quando ele já saiu, a imagem do CRT
  //    colapsa numa linha brilhante e apaga (tvoff, .55s)
  setTimeout(() => {
    start.classList.add('tvoff');
    audio.pararMusica();
    audio.zap();
  }, 1300);
  // 2) a TV religa já mostrando o menu: expande da mesma linha (tvon).
  //    A tela inicial fica escondida (não destruída) para o "voltar" reusá-la.
  setTimeout(() => {
    $('app').classList.remove('app-hidden');
    $('app').classList.add('app-reveal');
    start.classList.add('start-hidden');
    start.classList.remove('launching', 'tvoff');
    car.classList.remove('rolling');
    $('backBtn').classList.add('show');
    audio.tocarMusica('menu');
  }, 1850);
}

// ---- Voltar à tela inicial: o menu "desliga" e a TV religa no título ----
function voltarInicio() {
  const app = $('app');
  const start = $('startScreen');
  if (app.classList.contains('tvoff-app') || app.classList.contains('app-hidden')) return;
  audio.pararMusica();
  audio.zap();
  $('backBtn').classList.remove('show');
  app.classList.remove('app-reveal');
  app.classList.add('tvoff-app');
  setTimeout(() => {
    app.classList.add('app-hidden');
    app.classList.remove('tvoff-app');
    start.classList.remove('start-hidden');
    start.classList.add('tvon-start');
    audio.tocarMusica('title');
    setTimeout(() => start.classList.remove('tvon-start'), 700);
  }, 550);
}

// SHOW: exibe vértices e seus adjacentes.
function renderShow(grafo, caps) {
  $('show').innerHTML = caps
    .map((c) => {
      const viz = [...grafo.vizinhos(c)].map(([n, d]) => `${n} (${d}km)`).join(', ');
      return `<div class="adj"><b>${c}</b> [pedágio ${brl(grafo.pedagio(c))}] ➜ ${viz}</div>`;
    })
    .join('');
}

// Reexibe a janela de resultado com o "pop" pixelado (reinicia a animação).
function popResultWin() {
  const win = $('resWin');
  win.hidden = false;
  win.classList.remove('win-pop');
  void win.offsetWidth;
  win.classList.add('win-pop');
}

// Contador estilo placar de fliperama: o total sobe até o valor final.
function animarTotal(el, total) {
  if (REDUCE_MOTION) { el.textContent = brl(total); return; }
  const t0 = performance.now(), dur = 900;
  (function tick(now) {
    const k = Math.min(1, (now - t0) / dur);
    const ease = 1 - Math.pow(1 - k, 3);
    el.textContent = brl(total * ease);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}

function renderErro(msg) {
  popResultWin();
  $('result').innerHTML = `<div class="err">${msg}</div>`;
  audio.erro();
}

function buscar() {
  const o = $('origem').value.trim();
  const d = $('destino').value.trim();
  const fuel = parseFloat($('fuel').value);
  const aut = parseFloat($('auton').value);

  if (!GRAFO.existe(o) || !GRAFO.existe(d))
    return renderErro('! CAPITAL INVÁLIDA<br><span class="hint">Escolha origem e destino da lista.</span>');
  if (o === d) return renderErro('! ORIGEM = DESTINO');
  if (!(fuel > 0) || !(aut > 0)) return renderErro('! COMBUSTÍVEL/AUTONOMIA INVÁLIDOS');

  const r = buscarCaminhoMaisBarato(GRAFO, o, d, fuel, aut);
  if (!r) return renderErro(`✗ SEM ROTA ENTRE<br>${o.toUpperCase()} E ${d.toUpperCase()}`);

  const g = detalharGasto(GRAFO, r.caminho, fuel, aut);
  // cada chip/seta recebe --i para entrar em sequência (delay escalonado no CSS)
  const chips = r.caminho
    .map((c, i) =>
      `<span class="city" style="--i:${i}">${c}</span>` +
      (i < r.caminho.length - 1 ? `<span class="arrow" style="--i:${i}">➜</span>` : ''))
    .join('');

  popResultWin();
  $('result').innerHTML = `
    <div>🏁 Rota de menor custo:</div>
    <div class="route">${chips}</div>
    <div class="route-strip"><img class="mini-car" src="assets/car.png" alt="" draggable="false"></div>
    <div class="breakdown">📏 Distância total: <b>${g.km.toLocaleString('pt-BR')} km</b></div>
    <div class="breakdown">⛽ Combustível: ${brl(g.combustivel)} &nbsp;(${g.litros.toFixed(1)} L)</div>
    <div class="breakdown">🛣️ Pedágios: ${brl(g.pedagios)}</div>
    <div class="total">💰 TOTAL: <span id="totalVal">${brl(0)}</span></div>`;
  audio.jingle();
  animarTotal($('totalVal'), r.total);
}

function montarCenario() {
  // injeta o sprite do carro da tela inicial
  $('startCar').innerHTML = carHTML();

  // Áudio só pode nascer/retomar num gesto do usuário (política de autoplay).
  // Os listeners ficam ativos SEMPRE: após um F5 o browser exige novo gesto,
  // e se o contexto renascer suspenso o próximo clique/tecla o retoma.
  const gestoAudio = () => {
    audio.unlock();
    const start = $('startScreen');
    const naTelaInicial = start &&
      !start.classList.contains('start-hidden') &&
      !start.classList.contains('launching');
    if (naTelaInicial && !audio.tocando()) audio.tocarMusica('title');
  };
  document.addEventListener('pointerdown', gestoAudio);
  document.addEventListener('keydown', gestoAudio);

  // botão de som (♪): alterna mute e persiste a escolha
  const snd = $('sndBtn');
  const rotular = () => {
    snd.textContent = audio.mudo ? '♪ OFF' : '♪ ON';
    snd.classList.toggle('off', audio.mudo);
  };
  rotular();
  snd.addEventListener('click', () => {
    audio.alternarMudo();
    rotular();
    audio.blip();                 // só audível quando acabou de LIGAR
  });

  // VOLTAR: botão no topo esquerdo (ou tecla Esc no menu)
  $('backBtn').addEventListener('click', voltarInicio);

  // START: clique, Enter ou Espaço (só com a tela inicial visível)
  $('startBtn').addEventListener('click', iniciarJogo);
  document.addEventListener('keydown', (e) => {
    const start = $('startScreen');
    const naTelaInicial = start && !start.classList.contains('start-hidden');
    if (naTelaInicial && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      iniciarJogo();
    } else if (!naTelaInicial && e.key === 'Escape') {
      voltarInicio();
    }
  });
}

async function init() {
  montarCenario();
  GRAFO = await seed();
  const caps = GRAFO.vertices().sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('caps').innerHTML = caps.map((c) => `<option value="${c}">`).join('');
  renderShow(GRAFO, caps);

  $('go').addEventListener('click', buscar);
  [$('origem'), $('destino')].forEach((el) =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); })
  );
}

init().catch((e) => {
  renderErro('ERRO AO CARREGAR DADOS');
  console.error(e);
});
