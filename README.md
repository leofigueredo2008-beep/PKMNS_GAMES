# Pokémon Encounter Quiz

Quiz em que você digita o nome de todos os Pokémon que lembrar e eles aparecem em um globo 3D.
Os dados e sprites vêm da [PokéAPI](https://pokeapi.co) (precisa de internet).

## Páginas

- `index.html` – catálogo com os dois jogos
- `global-quiz.html` – o quiz do globo (jogo anterior)
- `near-or-away.html` – novo jogo estilo Contexto

## Como rodar

Abra o `index.html` no navegador. Não há build nem dependências.
Os scripts são "classic scripts" (não ES modules), então funciona direto via `file://`.

## Estrutura

```
index.html            marcação da página
css/                  (a ORDEM importa: o cascade é o mesmo do arquivo original)
  01-variables-themes.css   variáveis, tema claro, reset, body
  02-layout.css             componentes base, loading, @keyframes pop/spin
  03-settings-hints.css     painel de configurações, legenda, dicas
  04-congrats.css           diálogo de parabéns e confete
  05-filters-regions.css    filtros, cards da visão regional
  06-data-sheet.css         ficha técnica lateral
  07-globe.css              container do globo, pills e legenda
  08-fullscreen-layout.css  layout tela-cheia (botões flutuantes, barra de input)
  09-hud-responsive.css     mini HUD, responsivo, ajustes finais da ficha
js/                   (ordem de carregamento no index.html)
  config.js         constantes e dados estáticos
  utils.js          helpers puros + wrapper seguro de localStorage
  state.js          estado global mutável
  api.js            PokéAPI, sprites e caches
  forms.js          regras de formas alternativas (Mega, regionais, Gmax...)
  names.js          índice de nomes, resolução de respostas, detecção de typo
  globe-layout.js   distribuição dos Pokémon na esfera e territórios
  globe-render.js   desenho no canvas, animação e interação
  datasheet.js      ficha técnica (sprite, tipos, grito)
  hints.js          sistema de dicas
  ui.js             HUD, loading, settings, congrats, views legadas
  game.js           fluxo do jogo (filtros, relógio, start/reset, submit)
  main.js           eventos e inicialização
```

## Correções feitas

1. **HTML quebrado**: um `</div>` sobrando no painel de filtros fazia o navegador fechar `.card` e `.app`
   antes da hora, deixando todo o jogo fora do `<main>`. A estrutura foi corrigida.
2. **Bug de vizinhança no globo** (`drawGlobe`): a chave do grid espacial era `(gx+ox) + (gy+oy)` (soma de números)
   em vez de `"x,y"`. Por isso a distância ao vizinho mais próximo nunca era calculada corretamente e o
   limite de tamanho dos sprites não funcionava. Agora os sprites respeitam o espaçamento como o código pretendia.
3. **Cards não clicáveis**: `setupPokemonCardClicks` procurava `#viewPane`, que não existia. O id foi adicionado.
4. **Tema não atualizava o globo**: `setTheme` não repintava o canvas; agora chama `drawGlobe()`.
5. **localStorage sem proteção**: leituras/gravações podiam lançar exceção (modo privado, cota cheia) e
   derrubar o carregamento. Tudo passa por `storage.get/set`, que nunca lançam.
6. **Alternar MEGA/GIGANTAMAX** reconstruía o globo inteiro (`applyFilters`) e depois resetava de novo.
   Agora faz só o `resetGame()`.
7. **Typo** em apelido aceito: `"tatsugir mega"` → `"tatsugirimega"` (Mega Tatsugiri).
8. **Textos**: mensagem em português no meio da interface em inglês e frase de typo gramaticalmente errada
   foram padronizadas em inglês. `<title>` dizia "v5" num arquivo v7.

## Limpeza

- Removido código morto: `FORM_API`, `globeHoldUntil`, `formTypesDifferFromBase`, `shouldSplitGroupedFormForType`
  (sempre `false`), `matchesTypeFilterForDiscovery`, parâmetros `typeFilter` não usados e literais com `.replace(/\s/g, "")` sem sentido.
- Removido CSS morto (12 regras): `.modebar`, `.mode`, `.controls`, `.filters`, `.settings-row`, `.pokemon-types`,
  `.settings-option`, `.data-sheet-sprite`.

## Pontos para você decidir (não alterei)

- `view` nunca muda de `"globe"` e o modo HARD só esconde as bolinhas/cores. `renderHard`, `renderRegions`,
  `regionMembers`, `#hardGrid`, `#regionGrid` e o CSS da visão regional estão inalcançáveis hoje. Ficaram em
  `ui.js` e `05-filters-regions.css`, caso você queira reativar essas telas.
- O CSS tem várias regras sobrescritas por versões posteriores (ex.: `.card`, `.globe-wrap`, `.game-input`).
  Mantive a ordem exata para não mudar o visual; vale consolidar quando houver como testar no navegador.
- `drawGlobe` recria os objetos de todos os Pokémon a cada frame; se ficar pesado, vale cachear.

## Near or Away

Descubra o Pokémon secreto no centro do alvo. Cada palpite é posicionado pela **posição (rank) de 1 a 1025** de semelhança com o alvo.

- Dados: reaproveita `config.js`, `utils.js`, `state.js` e `api.js` do Global Quiz (mesma lista, tipos, gerações, regiões com Hisui separado e o mesmo cache em localStorage).
- `js/near/features.js`: busca características das espécies (cor, forma, habitat, grupo de ovo, gênero tipo "Mouse", lendário/mítico/bebê, linha evolutiva) e calcula a similaridade.
- Pesos (em `similarity`): mesma linha evolutiva 45, cada tipo em comum 14, mesma região 8, lendário/mítico 12, cor 8, forma 6, "animal" do gênero 10, grupo de ovo 5, habitat 4, inicial 3. Ajuste ali.
- Zonas (em `NEAR_RANK` / `FAR_RANK`): rank ≤ 40 sombra verde-amarelada, entre 41 e 250 amarela, > 250 vermelha. Só o Pokémon certo fica verde brilhante.
- `js/near/game.js`: rodada, alvo com anéis, lista de palpites e botão de desistir.
