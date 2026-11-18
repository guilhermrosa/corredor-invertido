# Arte final: ficha técnica

Como a arte provisória (desenhada por código) vai sendo trocada pela arte desenhada à mão, peça por peça, sem o jogo quebrar no meio.

## A divisão

- **Fica em código:** o mundo e os efeitos (corredor, chão, teto, colunas, buracos, perspectiva, luzes, raios, partículas, auréola dourada, asas das sandálias, faíscas).
- **Vira desenho:** o que tem personalidade: Xolo, os deuses ao fundo, Caronte, os presentes (romã, sandália, escudo), os ícones do placar e, mais tarde, os fundos (céu, mar, caverna, campos) e talvez os obstáculos.

Cada peça desenhada entra no lugar da provisória quando ficar pronta. Até lá o jogo continua usando a provisória.

## Estilo

- **Formas chapadas**, como a arte atual: cada parte tem uma cor de base e, no máximo, **um tom de sombra** (sombra dura, sem degradê). Luz vindo de cima e um pouco da esquerda.
- **Contorno simples**: cerca de 4 px numa tela de 512 px, na cor de uma versão escura do preenchimento (nada de preto puro). Linhas internas só onde ajudam a ler a forma (dedos, espinha, dobras de pano).
- **Sem textura**, sem pincel ruidoso, sem brilho pintado: os efeitos de luz o jogo faz por cima.
- **Paleta curta por personagem.** O Xolo de hoje usa: corpo `#e0636a`, sombra `#c84f5a`, contorno `#8f2a3a`, guelras `#c43a55`, sola `#f2a0a2`, crista do rabo `#f0b0ae`. Pode mudar, mas fica a referência.
- O mundo é claro (mármore creme `#f0eadc`, azul pintado `#2e4f86`, ouro `#d6a640`). O dourado continua sendo a cor do divino.

## Como entregar

- **Krita**: uma tela por peça, no tamanho da ficha abaixo, fundo transparente. Guarde o `.kra` com as camadas, para ajustes depois.
- **Exportar** em PNG com transparência (sRGB, 8 bits). Eu converto para o formato do jogo.
- **Nomes** sem acento e sem espaço, como na ficha (por exemplo `xolo-corrida-3.png`).
- **Mandar**: anexar no chat, ou subir no GitHub pela página do repositório, na pasta `docs/arte/entrada/` (botão *Add file → Upload files*).

## Modelos

Em `docs/arte/modelos/` há grades com a pose provisória do Xolo, clarinha, em cada quadro: a linha vermelha é o chão (os pés de apoio ficam nela) e a tracejada é o centro. No Krita: abra o modelo como camada de baixo, desenhe por cima nas camadas de cima, esconda o modelo e exporte cada quadro na sua tela de 512 × 512.

- `xolo-corrida.png`: 8 quadros de corrida
- `xolo-ar.png`: pulo (subindo, ápice, descendo)
- `xolo-deslize.png`: 2 quadros de deslize

## Ordem de produção

### 1. Quadro de estilo (antes de tudo)

Uma tela só, pintada do jeito que você imagina o jogo pronto (Xolo correndo nas ruínas, por exemplo), em 1080 × 1920. Não entra no jogo; serve para acertarmos traço, cor e luz antes de produzir as peças.

### 2. Xolo (o que mais aparece)

Visto **de costas**, como hoje. Tela 512 × 512 por quadro, pés de apoio na linha y = 440 (de cima para baixo), centro em x = 256, cabeça, guelras e rabo dentro da tela.

| Peça | Arquivos | Notas |
|---|---|---|
| Corrida | `xolo-corrida-1.png` … `-8.png` | um passo completo dos dois lados; o quadro 1 segue o 8 sem pulo |
| Pulo | `xolo-pulo-subindo.png`, `-apice.png`, `-descendo.png` | pernas encolhidas no ápice |
| Deslize | `xolo-deslize-1.png`, `-2.png` | de barriga, braços à frente (o escudo vai nas costas, o jogo põe) |
| Inversão | `xolo-giro-1.png` … `-4.png` | ele girando para o outro lado; pode ficar para depois |
| Queda no buraco | `xolo-queda.png` | braços para cima, afundando |
| Batida | `xolo-batida.png` | um quadro de susto/impacto |

Se der, desenhe as **guelras numa camada separada** e exporte também `xolo-corrida-1-guelras.png` etc.: assim o jogo pinta só as guelras de dourado quando ele está invertido. Se não der, o jogo usa um brilho por cima.

O braço com o escudo, as asas das sandálias e a auréola continuam por conta do código no começo.

### 3. Presentes e ícones

| Peça | Tela | Notas |
|---|---|---|
| `roma-dourada.png` | 256 × 256 | aberta de lado, sementes rubi (como hoje) |
| `sandalia.png` | 256 × 256 | de perfil, com a asa no tornozelo |
| `escudo.png` e `escudo-rachado.png` | 256 × 256 | borda azul, pontos dourados, coruja |
| `icone-roma.png`, `icone-roma-perdida.png`, `icone-roma-dourada.png` | 96 × 96 | para o placar |

### 4. Deuses ao fundo

Uma figura grande para o céu de cada luta, a partir das fichas de conceito (Zeus de branco com grega, Deméter, e os próximos). Tela 1024 × 1024, base da figura na borda de baixo. Na luta o jogo escurece e esfuma a figura conforme a distância e a tempestade.

### 5. Depois

Caronte e a cena do barco, fundos (céu, mar, caverna, campos) em camadas, e talvez os obstáculos.
