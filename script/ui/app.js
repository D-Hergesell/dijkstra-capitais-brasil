// ===== CAMADA DE APRESENTAÇÃO (UI) =====
// Orquestra as camadas de dados e serviço e renderiza a interface.

import { seed } from '../data/capitaisRepository.js';
import { buscarCaminhoMaisBarato, detalharGasto } from '../service/rotaService.js';

const $ = (id) => document.getElementById(id);
const brl = (n) =>
  'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let GRAFO = null;

// ---- Sprite do carro (pixel-art em divs) ----
const carHTML = () => `
  <img class="sprite" src="assets/car.png" alt="carro" draggable="false">
  <div class="smoke"><span></span><span></span><span></span></div>`;

// ---- Tela inicial: carro cruza com fumaça e revela o menu ----
function iniciarJogo() {
  const start = $('startScreen');
  const car = $('startCar');
  if (start.classList.contains('launching')) return;
  const smoke = $('smokeScreen');
  car.classList.add('rolling');
  start.classList.add('launching');

  // 1) fumaça começa a subir cobrindo a tela
  setTimeout(() => smoke.classList.add('active'), 650);
  // 2) no auge da fumaça, troca tela inicial pelo menu (escondido pela fumaça)
  setTimeout(() => {
    start.classList.add('fade');
    $('app').classList.remove('app-hidden');
    $('app').classList.add('app-reveal');
  }, 1150);
  setTimeout(() => start.remove(), 1500);
  // 3) fumaça se dissipa revelando o menu, depois é removida
  setTimeout(() => smoke.classList.remove('active'), 2400);
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

function renderErro(msg) {
  $('resWin').style.display = 'block';
  $('result').innerHTML = `<div class="err">${msg}</div>`;
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
  const chips = r.caminho
    .map((c, i) => `<span class="city">${c}</span>${i < r.caminho.length - 1 ? '<span class="arrow">➜</span>' : ''}`)
    .join('');

  $('resWin').style.display = 'block';
  $('result').innerHTML = `
    <div>🏁 Rota de menor custo:</div>
    <div class="route">${chips}</div>
    <div class="breakdown">📏 Distância total: <b>${g.km.toLocaleString('pt-BR')} km</b></div>
    <div class="breakdown">⛽ Combustível: ${brl(g.combustivel)} &nbsp;(${g.litros.toFixed(1)} L)</div>
    <div class="breakdown">🛣️ Pedágios: ${brl(g.pedagios)}</div>
    <div class="total">💰 TOTAL: ${brl(r.total)}</div>`;
}

function montarCenario() {
  // injeta o sprite do carro da tela inicial
  $('startCar').innerHTML = carHTML();

  // START: clique, Enter ou Espaço
  $('startBtn').addEventListener('click', iniciarJogo);
  document.addEventListener('keydown', (e) => {
    if ($('startScreen') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      iniciarJogo();
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
