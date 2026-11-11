# Corredor Invertido

Endless runner para navegador em túnel pseudo-3D. Um toque pula; um segundo toque, ainda no ar, inverte a gravidade e leva o personagem para o teto (ou de volta ao chão). A pontuação é a distância percorrida.

**Jogar:** https://guilhermrosa.github.io/corredor-invertido/ (depois de ativar o GitHub Pages, veja abaixo)

## Como jogar

| Ação | Celular | Teclado |
| --- | --- | --- |
| Pular | Toque | Espaço, ↑, ↓, W ou S |
| Inverter a gravidade | Toque de novo no ar | A mesma tecla de novo no ar |
| Voltar ao menu | Botão "← Menu" | Esc |

| Obstáculo | Cor provisória | Como passar |
| --- | --- | --- |
| Bloco alto | Vermelho | Inverter para o outro lado |
| Bloco baixo | Roxo | Pular |
| Buraco | Preto com borda vermelha | Pular ou estar no outro lado |
| Vazio (céu aberto) | Preto com estrelas | Ficar no lado que sobrou |

## Instalar como app

- **Android (Chrome):** menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início".

Depois de instalado, o jogo abre em tela cheia e funciona offline.

## Estrutura

Sem etapa de build: são arquivos estáticos com módulos JavaScript nativos.

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Página, menus e HUD |
| `css/style.css` | Estilo das telas |
| `js/main.js` | Loop do jogo, controles, menus, recorde, registro do service worker |
| `js/sim.js` | Simulação: física, geração de obstáculos, colisões. Não desenha nem toca som |
| `js/render.js` | Desenho do túnel em Canvas 2D com perspectiva calculada |
| `js/audio.js` | Efeitos e música que reagem ao jogo |
| `js/lyre.js` | Motor de som da lira (compartilhado com o repositório `lira-de-bolso`) |
| `js/config.js` | Constantes do mundo e paleta provisória |
| `sw.js` | Service worker (offline) |
| `manifest.webmanifest` | Dados do app instalável |
| `tools/make_icons.py` | Gera os ícones provisórios (`python3 tools/make_icons.py`, requer Pillow) |

A simulação é separada do desenho para que o renderer possa ser trocado (por exemplo, por Three.js) sem mexer na jogabilidade.

## Rodar localmente

Módulos JavaScript não carregam por `file://`, então use um servidor local:

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Publicar (GitHub Pages)

Uma vez só: em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`. Cada push na `main` publica a nova versão.

Ao lançar uma versão, aumente `VERSION` em `sw.js` para que quem instalou o app receba os arquivos novos.
