/**
 * Creates the playtest feedback form for Corredor Invertido in your Google account,
 * with a spreadsheet that collects the answers.
 *
 * How to use (once, best on a computer):
 * 1. Open https://script.google.com and click "Novo projeto".
 * 2. Delete what is in the editor, paste this whole file and save (Ctrl+S).
 * 3. Pick the function "criarFormulario" at the top and click "Executar".
 *    Google asks for permission to create forms and spreadsheets in your account: allow it.
 * 4. Open "Registro de execução" (execution log): it shows the form's links.
 *    - "Link para os testadores" is the one to send to people.
 *    - "Link de pré-preenchimento" is for the game: send it back so the game can open the form
 *      with the version and the stats already filled in.
 * Running it again creates another form; delete the old one in Google Drive if needed.
 */
function criarFormulario() {
  const form = FormApp.create('Corredor Invertido: feedback do protótipo');
  form.setDescription(
    'Obrigado por testar! Este é um protótipo: os desenhos ainda são provisórios, ' +
    'então o mais importante agora são os controles, as mecânicas e a sensação de jogar. ' +
    'Leva uns 5 minutos. Nenhuma pergunta é obrigatória.'
  );
  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('Valeu demais! Seu feedback vai direto para o desenvolvimento do jogo.');

  const AGREE = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente'];
  const RATE = ['Muito ruim', 'Ruim', 'Ok', 'Bom', 'Muito bom'];

  // ---- 1. Sobre você ----
  form.addSectionHeaderItem().setTitle('Sobre você');
  form.addTextItem().setTitle('Nome ou apelido (opcional)');
  form.addMultipleChoiceItem().setTitle('Onde você jogou?')
    .setChoiceValues(['Celular Android', 'iPhone', 'Computador', 'Tablet']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('Com que frequência você joga no celular?')
    .setChoiceValues(['Todo dia', 'Algumas vezes por semana', 'Raramente', 'Quase nunca']);
  form.addMultipleChoiceItem().setTitle('Quanto tempo você jogou o protótipo, mais ou menos?')
    .setChoiceValues(['Menos de 10 minutos', '10 a 30 minutos', '30 minutos a 1 hora', 'Mais de 1 hora']);

  // ---- 2. Controles e mecânicas ----
  form.addPageBreakItem().setTitle('Controles e mecânicas')
    .setHelpText('Toque para pular; toque de novo no ar (ou arraste para cima) para inverter a gravidade; arraste para baixo para deslizar.');
  form.addGridItem().setTitle('O quanto você concorda?')
    .setRows([
      'Pular é fácil e responde na hora',
      'Inverter a gravidade é fácil e responde na hora',
      'Deslizar (arrastar para baixo) funciona bem',
      'Entendo rápido o que fazer em cada obstáculo',
      'Quando eu erro, sinto que a culpa foi minha (o jogo é justo)',
      'A velocidade aumenta no ritmo certo',
      'O tutorial me ensinou o suficiente',
      'As vidas e o coração dourado deixam o jogo mais legal',
    ])
    .setColumns(AGREE);
  form.addMultipleChoiceItem().setTitle('Você inverteu a gravidade sem querer quando queria só pular de novo?')
    .setChoiceValues(['Muitas vezes', 'Às vezes', 'Nunca', 'Não sei dizer']);
  form.addCheckboxItem().setTitle('Algum controle te confundiu?')
    .setChoiceValues(['Pular', 'Inverter com dois toques', 'Inverter arrastando para cima', 'Deslizar', 'Nenhum']);
  form.addMultipleChoiceItem().setTitle('Quando a câmera gira ao inverter a gravidade...')
    .setChoiceValues([
      'Gostei do giro',
      'Fiquei um pouco tonto(a)',
      'Fiquei tonto(a) e troquei a opção em Opções → Giro da câmera',
      'Não reparei',
    ]);
  form.addCheckboxItem().setTitle('Quais obstáculos foram os mais difíceis? (marque até 3)')
    .setChoiceValues([
      'Mureta ou coluna caída (pular)',
      'Laje quebrada / buraco (pular)',
      'Muro em ruínas ou viga caída (inverter)',
      'Pórtico caído (deslizar)',
      'Coluna que tomba',
      'Bloco que despenca do teto',
      'Trechos sem chão ou sem teto',
      'Pontes (plataforma solta no vazio)',
      'Sequências rápidas de obstáculos',
    ]);
  form.addParagraphTextItem().setTitle('Teve algum momento em que você morreu e achou injusto? Conte como foi.');

  // ---- 3. Experiência ----
  form.addPageBreakItem().setTitle('Experiência');
  form.addGridItem().setTitle('Como você avalia...')
    .setRows(['O visual (mesmo provisório)', 'O som e a música', 'O personagem (o axolote)', 'A diversão em geral'])
    .setColumns(RATE);
  form.addScaleItem().setTitle('Nota geral para o protótipo').setBounds(1, 10).setLabels('Não gostei', 'Adorei');
  form.addMultipleChoiceItem().setTitle('Você jogaria de novo, por vontade própria?')
    .setChoiceValues(['Com certeza', 'Talvez', 'Provavelmente não']);
  form.addParagraphTextItem().setTitle('O que você mais gostou?');
  form.addParagraphTextItem().setTitle('O que mais te incomodou?');
  form.addParagraphTextItem().setTitle('Sugestões ou críticas (à vontade, qualquer coisa)');

  // ---- 4. Dados do jogo ----
  form.addPageBreakItem().setTitle('Dados do jogo (opcional)')
    .setHelpText('O jogo guarda estatísticas só no seu aparelho (distâncias, onde você morreu, ações). Elas ajudam muito a ajustar a dificuldade.');
  const versao = form.addTextItem().setTitle('Versão do jogo')
    .setHelpText('Aparece no topo do menu, por exemplo "Versão 0.36.2".');
  const dados = form.addParagraphTextItem().setTitle('Dados das estatísticas')
    .setHelpText('No jogo: Menu → Estatísticas → "Copiar dados". Depois toque e segure aqui e escolha Colar.');

  // Answers go to a new spreadsheet next to the form.
  const sheet = SpreadsheetApp.create('Corredor Invertido: respostas do feedback');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  // A pre-filled link the game can use (it swaps the two markers for the real values).
  const prefill = form.createResponse()
    .withItemResponse(versao.createResponse('__VERSAO__'))
    .withItemResponse(dados.createResponse('__DADOS__'))
    .toPrefilledUrl();

  Logger.log('Link para os testadores: ' + form.getPublishedUrl());
  Logger.log('Editar o formulário: ' + form.getEditUrl());
  Logger.log('Planilha de respostas: ' + sheet.getUrl());
  Logger.log('Link de pré-preenchimento (para o jogo): ' + prefill);
}
