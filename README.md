# 🚗 Caminho Mais Barato — Capitais do Brasil

> TD 02 — Cálculo da rota **mais barata** entre capitais brasileiras usando
> **Grafo + Dijkstra com Min-Heap**, em uma interface retrô estilo 16-bits.

O custo de uma rota não é só distância: leva em conta **combustível** (distância ÷
autonomia × preço do litro) e **pedágios** cobrados ao chegar em cada capital. O
algoritmo de Dijkstra encontra o trajeto que minimiza o gasto total em R$.

## ✨ Funcionalidades

- Busca da rota mais barata entre quaisquer duas capitais.
- Custo parametrizável: **preço do combustível** e **autonomia** do veículo.
- Detalhamento do gasto: km percorridos, litros, combustível e pedágios.
- Interface pixel-art com animação de carro e transição estilo TV de tubo (CRT).
- Trilha sonora e efeitos chiptune 16-bits sintetizados via Web Audio API (sem assets de áudio).

## 🗺️ Modelo de custo

Custo de percorrer a aresta `u → v`:

```
combustível = (distância_km / autonomia) * preço_combustível
pedágio     = pedágio da capital de destino (o da origem não conta)
custo       = combustível + pedágio
```

## 🏗️ Arquitetura

O código é organizado em camadas:

```
script/
├── data/    capitaisRepository.js   → carrega data/capitais.json
├── domain/  Grafo.js                → grafo não-direcionado (lista de adjacências)
│            MinHeap.js              → fila de prioridade para o Dijkstra
├── service/ rotaService.js          → Dijkstra + detalhamento do gasto
└── ui/      app.js                  → interação com a interface
```

A base de dados fica em [`data/capitais.json`](data/capitais.json): 27 capitais,
cada uma com seu **pedágio** e a lista de **vizinhos** com a distância em km. As
arestas são simétricas (mesma distância nos dois sentidos).

> **Nota:** Macapá não possui ligação rodoviária no dataset (`neighbors` vazio),
> então é, por definição, inalcançável por rota terrestre — comportamento
> intencional e verificado pelos testes.

## ▶️ Como rodar

Requer um servidor estático (os módulos ES são carregados via `fetch`):

```bash
npm start          # sobe em http://localhost:8000
```

Depois abra o endereço no navegador.

## 🧪 Testes

Há uma pequena bateria que valida **apenas** o `data/capitais.json` (JSON válido,
sem duplicatas, pedágios e distâncias positivos, referências de vizinhos válidas,
arestas simétricas, conectividade):

```bash
node test/capitais.test.mjs
```

## 📦 Stack

JavaScript (ES Modules) puro, HTML e CSS — sem dependências de runtime.

## 📄 Licença

MIT
