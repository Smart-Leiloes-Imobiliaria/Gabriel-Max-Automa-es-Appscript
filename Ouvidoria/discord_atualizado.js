// Preferir Script Properties (mais seguro e fácil de trocar sem republicar script).
// Chaves esperadas:
// - DISCORD_WEBHOOK_URL (Financiamento)
// - DISCORD_WEBHOOK_NPS_URL (NPS líderes)
// Fallbacks mantidos apenas para compatibilidade (recomendado remover após configurar as properties).
const DISCORD_WEBHOOK_URL_FALLBACK = 'https://discord.com/api/webhooks/1498024906841919650/TM5WKzJ9Xuw_AESYxWBLNKJ827BLH8wJ4iiJXfxKa7lh9q_snrEvye0bJLQvw5LELbZc'; //financiamento
const DISCORD_WEBHOOK_NPS_URL_FALLBACK = 'https://discord.com/api/webhooks/1503745411498774548/iTUXvcQKmPZylb_WobEhpi7A3raqMbzW5Vc5WzObnmv1dPZyig_ggPSJubASU5YCxOM7'; // nps

function getDiscordWebhookUrl_(kind) {
  const key = String(kind || '').trim();
  const props = PropertiesService.getScriptProperties();
  const fromProps = String(props.getProperty(key) || '').trim();
  if (fromProps) return fromProps;

  if (key === 'DISCORD_WEBHOOK_URL') {
    Logger.log('⚠️ DISCORD_WEBHOOK_URL não configurado em Script Properties. Usando fallback hardcoded.');
    return DISCORD_WEBHOOK_URL_FALLBACK;
  }
  if (key === 'DISCORD_WEBHOOK_NPS_URL') {
    Logger.log('⚠️ DISCORD_WEBHOOK_NPS_URL não configurado em Script Properties. Usando fallback hardcoded.');
    return DISCORD_WEBHOOK_NPS_URL_FALLBACK;
  }

  throw new Error('Webhook do Discord não configurado. Kind="' + key + '".');
}

const ABA_OUVIDORIA = 'Ouvidoria';

const COLUMN_MAPPING = {
  // Novo mapeamento (colunas por letra):
  // - Contato realizado com o cliente: E (5)
  // - Descrição da reclamação: Q (17)
  // - Causa raiz: S (19)
  // - Setor: T (20)
  // - Proprietário: U (21)
  // - Executor: V (22)
  // - Líder: W (23)
  // - Origem: X (24)
  // - Imóvel: A (1)
  // - Proponente principal: B (2)
  // - Telefone do cliente: C (3)
  // - Recorrência Imóvel: L (12)
  // - Recorrência Assunto: M (13)
  // - Recorrência NPS: N (14)
  //
  // Fallbacks desativados por padrão (evita ler campo errado quando o layout muda).
  COD_IMOVEL_PRIMARY: 1,           // Coluna A
  COD_IMOVEL_FALLBACK: 0,
  NOME_PROPONENTE_PRIMARY: 2,      // Coluna B
  NOME_PROPONENTE_FALLBACK: 0,
  TELEFONE_CLIENTE: 3,             // Coluna C
  CONTATO_CLIENTE_PRIMARY: 5,      // Coluna E (Sim/Não)
  CONTATO_CLIENTE_FALLBACK: 0,
  DESCRICAO_RECLAMACAO_PRIMARY: 17,// Coluna Q
  DESCRICAO_RECLAMACAO_FALLBACK: 0,
  ACAO_EFETIVA: 18,                // Coluna R - Ação efetiva
  CAUSA_RAIZ_PRIMARY: 19,          // Coluna S
  CAUSA_RAIZ_FALLBACK: 0,
  SETOR_PRIMARY: 20,               // Coluna T
  SETOR_FALLBACK: 0,
  EXECUTOR_PRIMARY: 22,            // Coluna V
  EXECUTOR_FALLBACK: 0,
  LIDER_PRIMARY: 23,               // Coluna W
  LIDER_FALLBACK: 0,
  ORIGEM_PRIMARY: 24,              // Coluna X
  ORIGEM_FALLBACK: 0,
  RECORRENCIA_IMOVEL: 12,          // Coluna L
  RECORRENCIA_ASSUNTO: 13,         // Coluna M
  RECORRENCIA_NPS: 14              // Coluna N
};

const DISCORD_USERS_BY_LIDER_NAME = {
  'jessica franklin': '1491411696236101683',
  'daniela silva': '1489378396894138572',
  'ana souza': '1489359034908807290',
  'isadora campos': '1478793740733776022',
  'thales gabriel': '1489359230644392037',
  'kaua amorim': '743866289813979158',
  'dimitri garcia': '1489358293360185534',
  'luiza cavalcanti': '1297961614020055051',
  'bianca neubaner': '1319697258240938054',
  'bruna pimentel': '1333777675113857076',
  'hana leticia': '1315690719457054731',
  'graziele rosa': '1283038273723306057',
  'jose magalhaes': '1374341675413143582'
};

const DISCORD_USERS_BY_EXECUTOR_NAME = {
  'ana carolina': '1364674206272327713',
  'jessica franklin': '1491411696236101683',
  'daniela silva': '1489378396894138572',
  'ana souza': '1489359034908807290',
  'isadora campos': '1478793740733776022',
  'thales gabriel': '1489359230644392037',
  'thales': '1489359230644392037',
  'daniela': '1489378396894138572',
  'isadora': '1478793740733776022'
};

const DISCORD_LOG_HEADER = 'Log Discord';

function findColumnByHeaderLocal_(sheet, headerName) {
  const headerRow = 1;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim() === headerName) return i + 1;
  }
  return 0;
}

function aoEditarCelula(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('⚠️ Discord: execução concorrente detectada. Ignorando este evento para evitar duplicidade.');
    return;
  }
  try {
    if (!e || !e.range) {
      Logger.log('⚠️ Evento inválido ou sem range.');
      return;
    }

    const range = e.range;
    const sheet = range.getSheet();

    if (sheet.getName() !== ABA_OUVIDORIA) {
      return;
    }

    // Evita loop em triggers instaláveis (alterações feitas via script também disparam onEdit).
    // Também evita processar alterações de cabeçalho.
    if (range.getRow() === 1) return;
    const logDiscordColExisting = findColumnByHeaderLocal_(sheet, DISCORD_LOG_HEADER);
    if (logDiscordColExisting && rangeContemColuna(range, logDiscordColExisting)) return;

    const editouOrigem =
      rangeContemColuna(range, COLUMN_MAPPING.ORIGEM_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.ORIGEM_FALLBACK);

    const editouCampoObrigatorio =
      rangeContemColuna(range, COLUMN_MAPPING.CONTATO_CLIENTE_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.CONTATO_CLIENTE_FALLBACK) ||
      rangeContemColuna(range, COLUMN_MAPPING.NOME_PROPONENTE_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.COD_IMOVEL_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.DESCRICAO_RECLAMACAO_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.DESCRICAO_RECLAMACAO_FALLBACK) ||
      rangeContemColuna(range, COLUMN_MAPPING.ACAO_EFETIVA) ||
      rangeContemColuna(range, COLUMN_MAPPING.CAUSA_RAIZ_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.CAUSA_RAIZ_FALLBACK) ||
      rangeContemColuna(range, COLUMN_MAPPING.SETOR_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.SETOR_FALLBACK) ||
      rangeContemColuna(range, COLUMN_MAPPING.EXECUTOR_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.EXECUTOR_FALLBACK) ||
      rangeContemColuna(range, COLUMN_MAPPING.LIDER_PRIMARY) ||
      rangeContemColuna(range, COLUMN_MAPPING.LIDER_FALLBACK) ||
      rangeContemColuna(range, COLUMN_MAPPING.COD_IMOVEL_FALLBACK);

    if (!editouOrigem && !editouCampoObrigatorio) {
      return;
    }

    const startRow = range.getRow();
    const numRows = range.getNumRows();

    for (let i = 0; i < numRows; i++) {
      const row = startRow + i;

      if (row <= 1) continue;

      if (!dedupeDiscordRowEvent_(sheet, row)) {
        Logger.log('⚠️ Discord: evento duplicado recente ignorado. Linha: ' + row);
        continue;
      }

      const logDiscordCol = ensureDiscordLogColumn_(sheet);
      const logAtual = sheet.getRange(row, logDiscordCol).getDisplayValue();

      if (/^OK:\s*mensagem/i.test(String(logAtual || ''))) {
        Logger.log(
          'Linha ' + row +
          ': Discord já enviado anteriormente. Ignorando. Log atual="' +
          logAtual +
          '"'
        );
        continue;
      }

      // Em algumas edições (principalmente quando há fórmulas/validação),
      // os campos "executor/líder/setor/origem" podem demorar 1-2s para refletir.
      // Esta leitura com espera evita validar como "vazio" indevidamente.
      const dadosNps = coletarDadosNpsAguardandoCampos_(sheet, row);

      Logger.log(
        'Discord avaliando linha ' + row +
        ' | origem="' + dadosNps.origem +
        '" | setor="' + dadosNps.setor +
        '" | executor="' + dadosNps.executor +
        '" | líder="' + dadosNps.lider +
        '" | imóvel="' + dadosNps.codImovel +
        '" | reclamação="' + dadosNps.descricaoReclamacao +
        '" | causaRaiz="' + dadosNps.causaRaiz + '"'
      );

      if (discordRateLimitAtivo_()) {
        sheet.getRange(row, logDiscordCol).setValue(
          'Não enviou: Discord em rate limit temporário. Tente novamente em instantes.'
        );

        Logger.log(
          '⚠️ Discord em rate limit. Envio ignorado temporariamente. Linha: ' + row
        );

        continue;
      }

      if (processarNpsAtendimentoDiscord_(sheet, row, dadosNps, logDiscordCol)) {
        continue;
      }

      // NPS de Financiamento usa o webhook de notificações-ouvidoria, nunca
      // o webhook padrão de líderes.
      if (
        isOrigemNpsDiscord_(dadosNps.origem) &&
        isSetorFinanciamentoDiscord(dadosNps.setor) &&
        processarFinanciamentoDiscord_(sheet, row, dadosNps, logDiscordCol)
      ) {
        continue;
      }

      if (processarNpsPadraoDiscord_(sheet, row, dadosNps, logDiscordCol)) {
        continue;
      }

     if (processarFinanciamentoDiscord_(sheet, row, dadosNps, logDiscordCol)) {
  continue;
}

function dedupeDiscordRowEvent_(sheet, row) {
  try {
    const cache = CacheService.getScriptCache();
    const key = 'discord_evt:' + sheet.getSheetId() + ':' + row;
    if (cache.get(key)) return false;
    cache.put(key, '1', 3);
    return true;
  } catch (_) {
    return true;
  }
}

      sheet.getRange(row, logDiscordCol).setValue(
        'Não enviou: origem/setor não se enquadra nas regras de Discord'
      );

      Logger.log(
        'Discord não enviado na linha ' +
        row +
        ': não é NPS Atendimento, NPS padrão nem Financiamento. Origem="' +
        dadosNps.origem +
        '", Setor="' +
        dadosNps.setor +
        '"'
      );
    }

  } catch (error) {
    Logger.log('❌ Erro em aoEditarCelula: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


function processarNpsAtendimentoDiscord_(sheet, row, dadosNps, logDiscordCol) {
  if (!deveEnviarNotificacaoNpsAtendimento_(dadosNps)) {
    return false;
  }

  const validacaoAtendimento = validarDadosNpsDiscordAtendimento(dadosNps);

  if (!validacaoAtendimento.ok) {
    const motivo = 'Não enviou NPS Atendimento: ' + validacaoAtendimento.reason;

    sheet.getRange(row, logDiscordCol).setValue(motivo);

    Logger.log(
      '⚠️ NPS Atendimento Discord não enviado na linha ' +
      row +
      ': ' +
      validacaoAtendimento.reason
    );

    return true;
  }

  const cacheKeyAtendimento = buildDiscordCacheKeyNpsAtendimento_(sheet, row, dadosNps);

  if (discordJaEnviadoRecentemente_(cacheKeyAtendimento)) {
    sheet.getRange(row, logDiscordCol).setValue(
      'Ignorado: mensagem NPS Atendimento já enviada recentemente ao Discord'
    );

    Logger.log(
      '⚠️ NPS Atendimento ignorado: mensagem já enviada recentemente. Linha: ' + row
    );

    return true;
  }

  const resp = enviarNotificacaoDiscordNpsAtendimento(dadosNps);
  marcarDiscordEnviado_(cacheKeyAtendimento);

  sheet.getRange(row, logDiscordCol).setValue(
    'OK: mensagem NPS Atendimento enviada ao Discord' +
    (resp && resp.id ? (' (msg_id=' + resp.id + ' ch=' + resp.channel_id + ' wh=' + (resp.webhook_id || '') + ')') : '')
  );

  Logger.log('✅ Notificação NPS Atendimento enviada ao Discord. Linha: ' + row);

  return true;
}


function processarNpsPadraoDiscord_(sheet, row, dadosNps, logDiscordCol) {
  if (!deveEnviarNotificacaoNps_(dadosNps)) {
    return false;
  }

  const validacaoNps = validarDadosNpsDiscord(dadosNps);

  if (!validacaoNps.ok) {
    const motivo = 'Não enviou NPS: ' + validacaoNps.reason;

    sheet.getRange(row, logDiscordCol).setValue(motivo);

    Logger.log(
      '⚠️ NPS Discord não enviado na linha ' +
      row +
      ': ' +
      validacaoNps.reason
    );

    return true;
  }

  const cacheKeyNps = buildDiscordCacheKey_(sheet, row, dadosNps);

  if (discordJaEnviadoRecentemente_(cacheKeyNps)) {
    sheet.getRange(row, logDiscordCol).setValue(
      'Ignorado: mensagem NPS já enviada recentemente ao Discord'
    );

    Logger.log(
      '⚠️ NPS ignorado: mensagem já enviada recentemente. Linha: ' + row
    );

    return true;
  }

  const resp = enviarNotificacaoDiscordNps(dadosNps);
  marcarDiscordEnviado_(cacheKeyNps);

  sheet.getRange(row, logDiscordCol).setValue(
    'OK: mensagem NPS enviada ao Discord' +
    (resp && resp.id ? (' (msg_id=' + resp.id + ' ch=' + resp.channel_id + ' wh=' + (resp.webhook_id || '') + ')') : '')
  );

  Logger.log('✅ Notificação NPS enviada ao Discord. Linha: ' + row);

  return true;
}


function processarFinanciamentoDiscord_(sheet, row, dados, logDiscordCol) {
  const setor = lerSetorDaLinha_(sheet, row);
  const setorOk = isSetorFinanciamentoDiscord(setor);

  Logger.log(
    'REGRA FINANCIAMENTO | setor="' +
    setor +
    '" | setorOk=' +
    setorOk
  );

  if (!setorOk) {
    return false;
  }

  const cacheKeyFin = buildDiscordCacheKeyFinanciamento_(sheet, row, dados);
  if (discordJaEnviadoRecentemente_(cacheKeyFin)) {
    sheet.getRange(row, logDiscordCol).setValue(
      'Ignorado: mensagem de financiamento já enviada recentemente ao Discord'
    );
    Logger.log('⚠️ Financiamento ignorado: mensagem já enviada recentemente. Linha: ' + row);
    return true;
  }

  const validacao = validarDadosDiscordFinanciamentoDireto_(dados);

  if (!validacao.ok) {
    const motivo = 'Não enviou financiamento: ' + validacao.reason;

    sheet.getRange(row, logDiscordCol).setValue(motivo);

    Logger.log(
      '⚠️ Discord financiamento não enviado na linha ' +
      row +
      ': ' +
      validacao.reason
    );

    return true;
  }

  const resp = enviarNotificacaoDiscordFinanciamentoDireto_(dados);
  marcarDiscordEnviado_(cacheKeyFin);

  sheet.getRange(row, logDiscordCol).setValue(
    'OK: mensagem de financiamento enviada ao Discord' +
    (resp && resp.id ? (' (msg_id=' + resp.id + ' ch=' + resp.channel_id + ' wh=' + (resp.webhook_id || '') + ')') : '')
  );

  Logger.log(
    '✅ Notificação de financiamento enviada ao Discord. Linha: ' + row
  );

  return true;
}

function buildDiscordCacheKeyFinanciamento_(sheet, row, dados) {
  const raw = [
    'financiamento',
    sheet.getSheetId(),
    row,
    dados.setor,
    dados.codImovel,
    dados.nomeProponente,
    dados.executor,
    dados.descricaoReclamacao,
    dados.acaoEfetiva
  ].join('|').slice(0, 500);

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  const hex = digest
    .map(function(b) {
      return (b + 256).toString(16).slice(-2);
    })
    .join('');

  return 'discord_fin:' + hex;
}
function validarDadosDiscordFinanciamentoDireto_(dados) {
  if (!campoObrigatorioCodigoImovelPreenchido_(dados.codImovel)) {
    return { ok: false, reason: 'código do imóvel vazio (coluna ' + COLUMN_MAPPING.COD_IMOVEL_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.nomeProponente)) {
    return { ok: false, reason: 'proponente vazio (coluna ' + COLUMN_MAPPING.NOME_PROPONENTE_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.descricaoReclamacao)) {
    return { ok: false, reason: 'descrição/reclamação vazia (coluna ' + COLUMN_MAPPING.DESCRICAO_RECLAMACAO_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.acaoEfetiva)) {
    return { ok: false, reason: 'ação efetiva vazia (coluna ' + COLUMN_MAPPING.ACAO_EFETIVA + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.contatoCliente)) {
    return { ok: false, reason: 'contato realizado com o cliente vazio (coluna ' + COLUMN_MAPPING.CONTATO_CLIENTE_PRIMARY + ')' };
  }

  return { ok: true };
}

function construirMensagemDiscordFinanciamentoDireto_(dados) {
  const executorComMencao = dados.executorComMencao;

  const mensagem =
`⚠️ **OUVIDORIA EM ANDAMENTO - FINANCIAMENTO** ⚠️

Codigo do imovel: \`${dados.codImovel}\`
Proponente: \`${dados.nomeProponente}\`
Executor: ${executorComMencao}
Contato realizado com o cliente: **${dados.contatoCliente}**
Descrição da reclamação : ${dados.descricaoReclamacao}
Ação efetiva a ser executada para concluir a ouvidoria : ${dados.acaoEfetiva}`;

  return mensagem;
}

function enviarNotificacaoDiscordFinanciamentoDireto_(dados) {
  const mensagem = construirMensagemDiscordFinanciamentoDireto_(dados);
  const executorDiscordUserIds = resolverDiscordUserIdsPorExecutorFinanciamento_(dados.executor);

  const payload = {
    content: mensagem,
    username: '𒀭 Sistemas - SmartCaixa',
    allowed_mentions: executorDiscordUserIds.length
      ? { users: executorDiscordUserIds }
      : { parse: [] }
  };

  return enviarPayloadDiscord_(getDiscordWebhookUrl_('DISCORD_WEBHOOK_URL'), payload, 'Financiamento');
}

function resolverDiscordUserIdsPorExecutorFinanciamento_(executorRaw) {
  const rawNorm = normalizarTextoDiscord(executorRaw);
  const regraDuasPessoasNorm = normalizarTextoDiscord('Interno - CCA Daniela/ Isadora');

  if (rawNorm && rawNorm === regraDuasPessoasNorm) {
    const daniela = DISCORD_USERS_BY_EXECUTOR_NAME['daniela silva'] || '1489378396894138572';
    const isadora = DISCORD_USERS_BY_EXECUTOR_NAME['isadora'] || '1478793740733776022';
    return [daniela, isadora].filter(Boolean);
  }

  const id = resolverDiscordUserIdPorExecutorFinanciamento_(executorRaw);
  return id ? [id] : [];
}

function resolverDiscordUserIdPorExecutorFinanciamento_(executorRaw) {
  const nomeExecutor = extrairNomeExecutorFinanciamento_(executorRaw);
  const nomeNorm = normalizarTextoDiscord(nomeExecutor);

  if (!nomeNorm) return '';

  if (DISCORD_USERS_BY_EXECUTOR_NAME[nomeNorm]) {
    return DISCORD_USERS_BY_EXECUTOR_NAME[nomeNorm];
  }

  const matches = [];

  for (const key in DISCORD_USERS_BY_EXECUTOR_NAME) {
    if (!Object.prototype.hasOwnProperty.call(DISCORD_USERS_BY_EXECUTOR_NAME, key)) continue;

    const keyNorm = normalizarTextoDiscord(key);

    if (
      nomeNorm === keyNorm ||
      nomeNorm.indexOf(keyNorm) !== -1 ||
      keyNorm.indexOf(nomeNorm) !== -1
    ) {
      matches.push(DISCORD_USERS_BY_EXECUTOR_NAME[key]);
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  Logger.log(
    'Executor sem ID Discord encontrado ou ambíguo. executorRaw="' +
    executorRaw +
    '" | nomeExtraido="' +
    nomeExecutor +
    '" | nomeNorm="' +
    nomeNorm +
    '"'
  );

  return '';
}

function extrairNomeExecutorFinanciamento_(executorRaw) {
  return String(executorRaw || '')
    .replace(/^\s*interno\s*[-–—]\s*/i, '')
    .replace(/^\s*externo\s*[-–—]\s*/i, '')
    .replace(/^\s*parceiro\s*[-–—]\s*/i, '')
    .replace(/^\s*cca\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function rangeContemColuna(range, colunaAlvo) {
  const colunaInicial = range.getColumn();
  const colunaFinal = colunaInicial + range.getNumColumns() - 1;

  return colunaAlvo >= colunaInicial && colunaAlvo <= colunaFinal;
}

function coletarDadosNps(sheet, row) {
  const lider = lerLiderDaLinha_(sheet, row) || 'Não informado';
  const liderDiscordUserId = resolverDiscordUserIdPorLider(lider);
  const mencaoLider = liderDiscordUserId ? '<@' + liderDiscordUserId + '>' : '';
  const executor = lerExecutorDaLinha_(sheet, row) || 'Não informado';
  const executorDiscordUserIds = resolverDiscordUserIdsPorExecutorFinanciamento_(executor);
  const mencaoExecutor = executorDiscordUserIds.length
    ? executorDiscordUserIds.map(function(id) { return '<@' + id + '>'; }).join(' ')
    : '';

  return {
    codImovel: lerCodImovelDaLinha_(sheet, row) || 'Não informado',
    nomeProponente: lerNomeProponenteDaLinha_(sheet, row) || 'Não informado',
    contatoCliente: lerContatoClienteDaLinha_(sheet, row) || 'Não informado',
    descricaoReclamacao: lerDescricaoReclamacaoDaLinha_(sheet, row) || 'Não informado',
    acaoEfetiva: lerTextoDaCelula(sheet, row, COLUMN_MAPPING.ACAO_EFETIVA, 'Não informado'),
    causaRaiz: lerCausaRaizDaLinha_(sheet, row) || 'Não informado',
    setor: lerSetorDaLinha_(sheet, row) || 'Não informado',
    executor: executor,
    executorDiscordUserIds: executorDiscordUserIds,
    mencaoExecutor: mencaoExecutor,
    executorComMencao: mencaoExecutor ? mencaoExecutor + ' ' + executor : executor,
    lider: lider,
    liderDiscordUserId: liderDiscordUserId,
    mencaoLider: mencaoLider,
    origem: lerOrigemDaLinha_(sheet, row) || 'Não informado'
  };
}

function lerSetorDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.SETOR_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.SETOR_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerCodImovelDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.COD_IMOVEL_PRIMARY).trim();
  // Para código do imóvel, "N/A" é um valor válido (preenchimento manual).
  if (primary) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.COD_IMOVEL_FALLBACK).trim();
  if (fallback) return fallback;

  return '';
}

function lerNomeProponenteDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.NOME_PROPONENTE_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.NOME_PROPONENTE_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerContatoClienteDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.CONTATO_CLIENTE_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.CONTATO_CLIENTE_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerDescricaoReclamacaoDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.DESCRICAO_RECLAMACAO_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.DESCRICAO_RECLAMACAO_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerCausaRaizDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.CAUSA_RAIZ_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.CAUSA_RAIZ_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerExecutorDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.EXECUTOR_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.EXECUTOR_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerLiderDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.LIDER_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.LIDER_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerOrigemDaLinha_(sheet, row) {
  const primary = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.ORIGEM_PRIMARY).trim();
  if (campoObrigatorioPreenchido_(primary)) return primary;

  const fallback = lerTextoColunaSegura_(sheet, row, COLUMN_MAPPING.ORIGEM_FALLBACK).trim();
  if (campoObrigatorioPreenchido_(fallback)) return fallback;

  return '';
}

function lerTextoColunaSegura_(sheet, row, col) {
  if (!col || Number(col) <= 0) return '';
  return lerTextoDaCelula(sheet, row, col, '');
}

function lerTextoDaCelula(sheet, row, col, valorPadrao) {
  const valor = sheet
    .getRange(row, col)
    .getDisplayValue()
    .toString()
    .trim();

  return valor || valorPadrao;
}


// timer para ler lider novamente 

function coletarDadosNpsAguardandoCampos_(sheet, row) {
  SpreadsheetApp.flush();

  let dados = coletarDadosNps(sheet, row);

  if (camposMinimosDiscordProntos_(dados)) {
    Logger.log(
      'Campos já disponíveis na primeira leitura. Linha ' + row +
      ' | origem="' + dados.origem +
      '" | setor="' + dados.setor +
      '" | executor="' + dados.executor +
      '" | líder="' + dados.lider + '"'
    );

    return dados;
  }

  for (let tentativa = 1; tentativa <= 12; tentativa++) {
    Utilities.sleep(1000);
    SpreadsheetApp.flush();

    dados = coletarDadosNps(sheet, row);

    Logger.log(
      'Tentativa ' + tentativa +
      ' lendo campos da linha ' + row +
      ' | origem="' + dados.origem +
      '" | setor="' + dados.setor +
      '" | executor="' + dados.executor +
      '" | líder="' + dados.lider + '"'
    );

    if (camposMinimosDiscordProntos_(dados)) {
      Logger.log(
        'Campos encontrados após espera. Linha ' + row +
        ' | origem="' + dados.origem +
        '" | setor="' + dados.setor +
        '" | executor="' + dados.executor +
        '" | líder="' + dados.lider + '"'
      );

      return dados;
    }
  }

  Logger.log(
    'Campos continuaram incompletos após espera. Linha ' + row +
    ' | origem="' + dados.origem +
    '" | setor="' + dados.setor +
    '" | executor="' + dados.executor +
    '" | líder="' + dados.lider + '"'
  );

  return dados;
}

function camposMinimosDiscordProntos_(dados) {
  const setor = String(dados && dados.setor ? dados.setor : '').trim();
  const setorFin = isSetorFinanciamentoDiscord(setor);

  // Para Financiamento, a Origem não é obrigatória para envio. O que costuma atrasar
  // é preenchimento por automação (proponente/descrição/ação). Então aguardamos esses campos.
  if (setorFin) {
    return (
      campoObrigatorioPreenchido_(dados.setor) &&
      campoObrigatorioPreenchido_(dados.codImovel) &&
      campoObrigatorioPreenchido_(dados.nomeProponente) &&
      campoObrigatorioPreenchido_(dados.descricaoReclamacao) &&
      campoObrigatorioPreenchido_(dados.acaoEfetiva) &&
      campoObrigatorioPreenchido_(dados.contatoCliente)
    );
  }

  // NPS: exige origem + setor + executor + líder + confirmação de contato.
  return (
    campoObrigatorioPreenchido_(dados.origem) &&
    campoObrigatorioPreenchido_(dados.setor) &&
    campoObrigatorioPreenchido_(dados.executor) &&
    campoObrigatorioPreenchido_(dados.lider) &&
    campoObrigatorioPreenchido_(dados.contatoCliente)
  );
}










function resolverDiscordUserIdPorLider(liderRaw) {
  const liderNorm = normalizarTextoDiscord(liderRaw);

  if (!liderNorm) return '';

  if (DISCORD_USERS_BY_LIDER_NAME[liderNorm]) {
    return DISCORD_USERS_BY_LIDER_NAME[liderNorm];
  }

  const matches = [];

  for (const key in DISCORD_USERS_BY_LIDER_NAME) {
    if (!Object.prototype.hasOwnProperty.call(DISCORD_USERS_BY_LIDER_NAME, key)) continue;

    if (
      liderNorm === key ||
      liderNorm.indexOf(key) !== -1 ||
      key.indexOf(liderNorm) !== -1
    ) {
      matches.push(DISCORD_USERS_BY_LIDER_NAME[key]);
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return '';
}

function montarMencaoLiderDiscord(liderRaw) {
  const userId = resolverDiscordUserIdPorLider(liderRaw);

  if (userId) {
    return '<@' + userId + '>';
  }

  return '';
}



function deveEnviarNotificacaoNpsAtendimento_(dados) {
  const origemOk = isOrigemNps1ou2Discord_(dados.origem) || isOrigemNpsDiscord_(dados.origem);
  const setorOk = isSetorAtendimentoPosArrematacaoDiscord_(dados.setor);

  Logger.log(
    'REGRA NPS ATENDIMENTO | origem="' + dados.origem +
    '" | origemOk=' + origemOk +
    ' | setor="' + dados.setor +
    '" | setorOk=' + setorOk
  );

  return origemOk && setorOk;
}
function deveEnviarNotificacaoNps_(dados) {
  const origemOk = isOrigemNps1ou2Discord_(dados.origem) || isOrigemNpsDiscord_(dados.origem);
  const setorAtendimento = isSetorAtendimentoPosArrematacaoDiscord_(dados.setor);

  Logger.log(
    'REGRA NPS PADRÃO | origem="' + dados.origem +
    '" | origemOk=' + origemOk +
    ' | setor="' + dados.setor +
    '" | setorAtendimento=' + setorAtendimento
  );

  return origemOk && !setorAtendimento;
}

function isSetorFinanciamentoDiscord(setor) {
  const s = normalizarTextoDiscord(setor);

  return (
    s === 'financiamento' ||
    s.indexOf('financiamento') !== -1
  );
}
function isOrigemNpsDiscord_(origem) {
  const origemNorm = normalizarTextoDiscord(origem);

  // A coluna Origem agora vem como "NPS 1" ou "NPS 2".
  return origemNorm === 'nps 1' || origemNorm === 'nps 2' || origemNorm === 'nps';
}

function isOrigemNps1ou2Discord_(origem) {
  const origemNorm = normalizarTextoDiscord(origem);
  return origemNorm === 'nps 1' || origemNorm === 'nps 2';
}

function obterNotaNpsParaMensagem_(origem) {
  const origemNorm = normalizarTextoDiscord(origem);
  if (origemNorm === 'nps 1') return 'nota 1';
  if (origemNorm === 'nps 2') return 'nota 2';
  return 'NPS';
}

function isSetorAtendimentoPosArrematacaoDiscord_(setor) {
  const s = normalizarTextoDiscord(setor);

  return (
    s === 'atendimento pos arrematacao' ||
    s === 'atendimento pos arrematacao' ||
    s.indexOf('atendimento pos') !== -1 ||
    s.indexOf('pos arrematacao') !== -1
  );
}

function campoObrigatorioPreenchido_(valor) {
  const texto = String(valor || '').trim();

  if (!texto) return false;

  const textoNorm = normalizarTextoDiscord(texto);

  if (textoNorm === 'nao informado') return false;
  if (textoNorm === 'n a') return false;
  if (textoNorm === 'n/a') return false;

  return true;
}

function campoObrigatorioCodigoImovelPreenchido_(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return false;
  const textoNorm = normalizarTextoDiscord(texto);
  // "N/A" (normaliza para "n a") é válido para envio Discord.
  if (textoNorm === 'n a' || textoNorm === 'n/a') return true;
  if (typeof isCodigoImovelManual_ === 'function' && isCodigoImovelManual_(texto)) return true;
  return campoObrigatorioPreenchido_(texto);
}

function validarDadosNpsDiscordAtendimento(dados) {
  if (!campoObrigatorioPreenchido_(dados.contatoCliente)) {
    return { ok: false, reason: 'contato realizado com o cliente vazio (coluna ' + COLUMN_MAPPING.CONTATO_CLIENTE_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.setor)) {
    return { ok: false, reason: 'setor vazio (coluna ' + COLUMN_MAPPING.SETOR_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.executor)) {
    return { ok: false, reason: 'responsável/executor vazio (coluna ' + COLUMN_MAPPING.EXECUTOR_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.lider)) {
    return { ok: false, reason: 'líder vazio (coluna ' + COLUMN_MAPPING.LIDER_PRIMARY + ')' };
  }

  if (!dados.liderDiscordUserId) {
    return {
      ok: false,
      reason: 'líder sem ID do Discord mapeado: ' + dados.lider
    };
  }

  if (!campoObrigatorioCodigoImovelPreenchido_(dados.codImovel)) {
    return { ok: false, reason: 'imóvel/código do imóvel vazio (coluna ' + COLUMN_MAPPING.COD_IMOVEL_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.descricaoReclamacao)) {
    return { ok: false, reason: 'reclamação do cliente vazia (coluna ' + COLUMN_MAPPING.DESCRICAO_RECLAMACAO_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.causaRaiz)) {
    return { ok: false, reason: 'análise do caso/causa raiz vazia (coluna ' + COLUMN_MAPPING.CAUSA_RAIZ_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.origem)) {
    return { ok: false, reason: 'origem vazia (coluna ' + COLUMN_MAPPING.ORIGEM_PRIMARY + ')' };
  }

  if (!isOrigemNps1ou2Discord_(dados.origem) && !isOrigemNpsDiscord_(dados.origem)) {
    return { ok: false, reason: 'origem diferente de NPS 1/2' };
  }

  if (!isSetorAtendimentoPosArrematacaoDiscord_(dados.setor)) {
    return {
      ok: false,
      reason: 'setor não é Atendimento Pós-arrematação'
    };
  }

  return { ok: true };
}

function validarDadosNpsDiscord(dados) {
  if (!campoObrigatorioPreenchido_(dados.contatoCliente)) {
    return { ok: false, reason: 'contato realizado com o cliente vazio (coluna ' + COLUMN_MAPPING.CONTATO_CLIENTE_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.setor)) {
    return { ok: false, reason: 'setor vazio (coluna ' + COLUMN_MAPPING.SETOR_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.executor)) {
    return { ok: false, reason: 'responsável/executor vazio (coluna ' + COLUMN_MAPPING.EXECUTOR_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.lider)) {
    return { ok: false, reason: 'líder vazio (coluna ' + COLUMN_MAPPING.LIDER_PRIMARY + ')' };
  }

  if (!dados.liderDiscordUserId) {
    return {
      ok: false,
      reason: 'líder sem ID do Discord mapeado: ' + dados.lider
    };
  }

  if (!campoObrigatorioCodigoImovelPreenchido_(dados.codImovel)) {
    return { ok: false, reason: 'imóvel/código do imóvel vazio (coluna ' + COLUMN_MAPPING.COD_IMOVEL_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.descricaoReclamacao)) {
    return { ok: false, reason: 'reclamação do cliente vazia (coluna ' + COLUMN_MAPPING.DESCRICAO_RECLAMACAO_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.causaRaiz)) {
    return { ok: false, reason: 'análise do caso/causa raiz vazia (coluna ' + COLUMN_MAPPING.CAUSA_RAIZ_PRIMARY + ')' };
  }

  if (!campoObrigatorioPreenchido_(dados.origem)) {
    return { ok: false, reason: 'origem vazia (coluna ' + COLUMN_MAPPING.ORIGEM_PRIMARY + ')' };
  }

  if (!isOrigemNps1ou2Discord_(dados.origem) && !isOrigemNpsDiscord_(dados.origem)) {
    return { ok: false, reason: 'origem diferente de NPS 1/2' };
  }

  if (isSetorAtendimentoPosArrematacaoDiscord_(dados.setor)) {
    return {
      ok: false,
      reason: 'setor Atendimento - Pós-arrematação não deve receber esta notificação NPS padrão'
    };
  }

  return { ok: true };
}

function construirMensagemDiscordNpsAtendimento(dados) {
  const origemLabel = isOrigemNps1ou2Discord_(dados.origem) ? String(dados.origem).trim() : 'NPS';
  const notaLabel = obterNotaNpsParaMensagem_(dados.origem);
  const executorComMencao = dados.executorComMencao;
  const liderComMencao = dados.mencaoLider
    ? dados.mencaoLider + ' ' + dados.lider
    : dados.lider;

  const mensagem =
`🚨**NOTIFICAÇÃO ${origemLabel} | OUVIDORIA ${dados.setor}**🚨

🚨 **Recebemos uma avaliação de ${notaLabel} referente: Atendimento Pós-arrematação**🚨

**Responsável** : ${executorComMencao}

**Líder** : ${liderComMencao}

**Contato realizado com o cliente** : ${dados.contatoCliente}

**Imóvel** : ${dados.codImovel}

📝 **Reclamação do cliente** : ${dados.descricaoReclamacao}

🔎 **Análise do caso** : ${dados.causaRaiz}

‼️ **Reforçamos a necessidade de tratativa com prioridade e estabelecimento de plano de ação por parte dos líderes, considerando o impacto de avaliações ${notaLabel} na experiência do cliente.**

**Ficamos no aguardo do retorno com as ações implementadas.**

**Atenciosamente**,
**Ouvidoria**`;

  return mensagem;
}

function construirMensagemDiscordNps(dados) {
  const origemLabel = isOrigemNps1ou2Discord_(dados.origem) ? String(dados.origem).trim() : 'NPS';
  const notaLabel = obterNotaNpsParaMensagem_(dados.origem);
  const executorComMencao = dados.executorComMencao;
  const liderComMencao = dados.mencaoLider
    ? dados.mencaoLider + ' ' + dados.lider
    : dados.lider;

  const mensagem =
`⚠️ **NOTIFICAÇÃO ${origemLabel} | OUVIDORIA ${dados.setor}** ⚠️

🚨 **Recebemos uma avaliação de ${notaLabel} referente**🚨 

**Responsável** : ${executorComMencao}

**Líder** : ${liderComMencao}

**Contato realizado com o cliente** : ${dados.contatoCliente}

**Imóvel** : ${dados.codImovel}

📝 **Reclamação do cliente** : ${dados.descricaoReclamacao}

🔎 **Análise do caso** : ${dados.causaRaiz}

‼️ **Reforçamos a necessidade de tratativa com prioridade e estabelecimento de plano de ação por parte dos líderes, considerando o impacto de avaliações ${notaLabel} na experiência do cliente.**`;

  return mensagem;
}

function enviarNotificacaoDiscordNpsAtendimento(dados) {
  const mensagem = construirMensagemDiscordNpsAtendimento(dados);
  const mentions = [];
  if (dados.liderDiscordUserId) mentions.push(dados.liderDiscordUserId);
  if (dados.executorDiscordUserIds && dados.executorDiscordUserIds.length) {
    mentions.push.apply(mentions, dados.executorDiscordUserIds);
  }

  const payload = {
    content: mensagem,
    username: '𒀭 Sistemas - SmartCaixa',
    allowed_mentions: mentions.length ? { users: mentions } : { parse: [] }
  };

  return enviarPayloadDiscord_(getDiscordWebhookUrl_('DISCORD_WEBHOOK_NPS_URL'), payload, 'NPS Atendimento');
}

function enviarNotificacaoDiscordNps(dados) {
  const mensagem = construirMensagemDiscordNps(dados);
  const mentions = [];
  if (dados.liderDiscordUserId) mentions.push(dados.liderDiscordUserId);
  if (dados.executorDiscordUserIds && dados.executorDiscordUserIds.length) {
    mentions.push.apply(mentions, dados.executorDiscordUserIds);
  }

  const payload = {
    content: mensagem,
    username: '𒀭 Sistemas - SmartCaixa',
    allowed_mentions: mentions.length ? { users: mentions } : { parse: [] }
  };

  return enviarPayloadDiscord_(getDiscordWebhookUrl_('DISCORD_WEBHOOK_NPS_URL'), payload, 'NPS');
}

function enviarPayloadDiscord_(webhookUrl, payload, contexto) {
  const sendLock = LockService.getScriptLock();
  if (!sendLock.tryLock(15000)) {
    Logger.log('⚠️ Discord: envio concorrente bloqueado (lock). Contexto: ' + contexto);
    throw new Error('Envio Discord concorrente bloqueado (lock).');
  }
  const maxTentativas = 3;
  const urlComWait = appendDiscordWaitTrue_(webhookUrl);
  const webhookInfo = extractDiscordWebhookInfo_(webhookUrl);

  try {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      try {
        const response = UrlFetchApp.fetch(urlComWait, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode === 200) {
        const meta = tryParseDiscordMessageMeta_(responseText);
        if (!meta) {
          Logger.log(
            '⚠️ Discord retornou 200, mas não foi possível validar o corpo de resposta como mensagem do Discord. ' +
            'Contexto: ' + contexto + ' | resposta=' + responseText
          );
          throw new Error('Resposta 200 não validada como Discord message (provável webhook URL incorreta).');
        }
        const result = {
          id: meta.id,
          channel_id: meta.channel_id,
          webhook_id: webhookInfo ? webhookInfo.webhookId : ''
        };

        Logger.log(
          '✅ Discord enviado com sucesso. Contexto: ' +
          contexto +
          ' | tentativa=' +
          tentativa +
          ' | message_id=' + meta.id +
          ' | channel_id=' + meta.channel_id +
          (webhookInfo ? (' | webhook_id=' + webhookInfo.webhookId) : '')
        );
        return result;
      }
      if (responseCode === 204) {
        Logger.log(
          '✅ Discord enviado (204). Contexto: ' +
          contexto +
          ' | tentativa=' +
          tentativa +
          (webhookInfo ? (' | webhook_id=' + webhookInfo.webhookId) : '')
        );
        return { ok: true, webhook_id: webhookInfo ? webhookInfo.webhookId : '' };
      }

      if (responseCode === 429) {
        const headers = response.getAllHeaders ? response.getAllHeaders() : {};

        let retryAfter =
          headers['Retry-After'] ||
          headers['retry-after'] ||
          headers['X-RateLimit-Reset-After'] ||
          headers['x-ratelimit-reset-after'] ||
          2;

        retryAfter = Number(retryAfter);

        if (isNaN(retryAfter) || retryAfter <= 0) {
          retryAfter = 2;
        }

        // Se vier em milissegundos ou muito alto, limita para não estourar execução.
        const waitMs = Math.min(Math.ceil(retryAfter * 1000), 10000);

        Logger.log(
          '⚠️ Discord retornou 429. Contexto: ' +
          contexto +
          ' | tentativa=' +
          tentativa +
          ' de ' +
          maxTentativas +
          ' | aguardando ' +
          waitMs +
          'ms'
        );

        Logger.log('Resposta Discord: ' + responseText);

        // Marca rate limit e evita insistir no mesmo payload (pode piorar o 429).
        marcarDiscordRateLimit_(Math.max(60, Math.ceil(waitMs / 1000)));
        throw new Error(
          'Discord em rate limit (429). Aguarde ~' +
          Math.ceil(waitMs / 1000) +
          's e tente novamente. Contexto=' +
          contexto
        );
      }

      Logger.log('❌ Discord retornou código: ' + responseCode + '. Contexto: ' + contexto);
      Logger.log('Resposta: ' + responseText);
      if (webhookInfo) Logger.log('Webhook: id=' + webhookInfo.webhookId + ' host=' + webhookInfo.host);

      throw new Error('Discord retornou código ' + responseCode);

      } catch (error) {
        if (tentativa < maxTentativas) {
          Logger.log(
            '⚠️ Erro ao enviar Discord. Contexto: ' +
            contexto +
            ' | tentativa=' +
            tentativa +
            ' | erro=' +
            error.toString() +
            ' | tentando novamente em 2s'
          );

          Utilities.sleep(2000);
          continue;
        }

        Logger.log(
          '❌ Erro final ao enviar para Discord. Contexto: ' +
          contexto +
          '. Erro: ' +
          error.toString()
        );
        if (webhookInfo) Logger.log('Webhook: id=' + webhookInfo.webhookId + ' host=' + webhookInfo.host);

        throw error;
      }
    }

    return false;
  } finally {
    try { sendLock.releaseLock(); } catch (_) {}
  }
}

function appendDiscordWaitTrue_(webhookUrl) {
  const url = String(webhookUrl || '').trim();
  if (!url) return url;
  if (/[\?&]wait=/i.test(url)) return url;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'wait=true';
}

function tryParseDiscordMessageMeta_(responseText) {
  try {
    const obj = JSON.parse(String(responseText || '').trim() || '{}');
    if (obj && obj.id && obj.channel_id) {
      return { id: String(obj.id), channel_id: String(obj.channel_id) };
    }
    return null;
  } catch (_) {
    return null;
  }
}

function extractDiscordWebhookInfo_(webhookUrl) {
  try {
    const url = String(webhookUrl || '').trim();
    if (!url) return null;
    const m = url.match(/discord(?:app)?\.com\/api\/webhooks\/([0-9]+)/i);
    if (!m) return null;
    const host = (function() {
      try {
        return new URL(url).host;
      } catch (_) {
        return url.replace(/^https?:\/\//i, '').split('/')[0];
      }
    })();
    return { webhookId: String(m[1]), host: host };
  } catch (_) {
    return null;
  }
}

function normalizarTextoDiscord(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, ' ')
    .replace(/[-_\/\\]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function ensureDiscordLogColumn_(sheet) {
  const headerRow = 1;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];

  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim() === DISCORD_LOG_HEADER) {
      return i + 1;
    }
  }

  sheet.getRange(headerRow, lastCol + 1).setValue(DISCORD_LOG_HEADER);
  return lastCol + 1;
}

function buildDiscordCacheKey_(sheet, row, dados) {
  const raw = [
    'nps_padrao',
    sheet.getSheetId(),
    row,
    dados.origem,
    dados.setor,
    dados.contatoCliente,
    dados.codImovel,
    dados.executor,
    dados.lider,
    dados.descricaoReclamacao,
    dados.causaRaiz
  ].join('|').slice(0, 500);

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);

  const hex = digest
    .map(function(b) {
      return (b + 256).toString(16).slice(-2);
    })
    .join('');

  // Prefixo não deve sugerir NPS 1; a origem (NPS 1/NPS 2) já faz parte do raw.
  return 'discord_nps:' + hex;
}

function buildDiscordCacheKeyNpsAtendimento_(sheet, row, dados) {
  const raw = [
    'nps_atendimento',
    sheet.getSheetId(),
    row,
    dados.origem,
    dados.setor,
    dados.contatoCliente,
    dados.codImovel,
    dados.executor,
    dados.lider,
    dados.descricaoReclamacao,
    dados.causaRaiz
  ].join('|').slice(0, 500);

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);

  const hex = digest
    .map(function(b) {
      return (b + 256).toString(16).slice(-2);
    })
    .join('');

  return 'discord_nps_atendimento:' + hex;
}

function discordJaEnviadoRecentemente_(cacheKey) {
  return !!CacheService.getScriptCache().get(cacheKey);
}

function marcarDiscordEnviado_(cacheKey) {
  CacheService.getScriptCache().put(cacheKey, '1', 21600);
}

function discordRateLimitAtivo_() {
  return !!CacheService.getScriptCache().get('discord_rate_limit_ativo');
}

function marcarDiscordRateLimit_(segundos) {
  const ttl = Math.max(30, Math.min(Number(segundos || 60), 300));
  CacheService.getScriptCache().put('discord_rate_limit_ativo', '1', ttl);
}

// Utilitário: permite forçar reenvio limpando o cache de "já enviado" para uma linha.
function resetarCacheDiscordLinha(row) {
  var linha = Number(row || 0);
  if (!linha || linha < 2) throw new Error('Informe uma linha >= 2. Ex: resetarCacheDiscordLinha(3)');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_OUVIDORIA);
  if (!sheet) throw new Error('Aba "' + ABA_OUVIDORIA + '" não encontrada.');

  var dados = coletarDadosNpsAguardandoCampos_(sheet, linha);
  var keys = [];
  try { keys.push(buildDiscordCacheKey_(sheet, linha, dados)); } catch (_) {}
  try { keys.push(buildDiscordCacheKeyNpsAtendimento_(sheet, linha, dados)); } catch (_) {}
  try { keys.push(buildDiscordCacheKeyFinanciamento_(sheet, linha, dados)); } catch (_) {}

  keys = keys.filter(Boolean);
  var cache = CacheService.getScriptCache();
  if (cache.removeAll) {
    cache.removeAll(keys);
  } else {
    for (var i = 0; i < keys.length; i++) cache.remove(keys[i]);
  }
  Logger.log('✅ Cache Discord removido para linha ' + linha + ': ' + keys.join(' | '));
  return { ok: true, row: linha, keys: keys };
}

function testarEnvioNpsDiscordLinha3() {
  const row = 3;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABA_OUVIDORIA);

  if (!sheet) {
    throw new Error('Aba "' + ABA_OUVIDORIA + '" não encontrada.');
  }

  const dados = coletarDadosNps(sheet, row);

  Logger.log(JSON.stringify(dados, null, 2));

  if (!deveEnviarNotificacaoNps_(dados)) {
    Logger.log(
      'Não enviou NPS padrão: regra não atendida. Origem="' +
      dados.origem +
      '", Setor="' +
      dados.setor +
      '"'
    );
    return;
  }

  const validacao = validarDadosNpsDiscord(dados);

  if (!validacao.ok) {
    Logger.log('Não enviou NPS padrão: ' + validacao.reason);
    return;
  }

  enviarNotificacaoDiscordNps(dados);

  Logger.log('✅ Teste NPS padrão enviado com dados reais da linha ' + row);
}

function testarEnvioNpsAtendimentoDiscordLinha3() {
  const row = 3;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABA_OUVIDORIA);

  if (!sheet) {
    throw new Error('Aba "' + ABA_OUVIDORIA + '" não encontrada.');
  }

  const dados = coletarDadosNps(sheet, row);

  Logger.log(JSON.stringify(dados, null, 2));

  if (!deveEnviarNotificacaoNpsAtendimento_(dados)) {
    Logger.log(
      'Não enviou NPS Atendimento: regra não atendida. Origem="' +
      dados.origem +
      '", Setor="' +
      dados.setor +
      '"'
    );
    return;
  }

  const validacao = validarDadosNpsDiscordAtendimento(dados);

  if (!validacao.ok) {
    Logger.log('Não enviou NPS Atendimento: ' + validacao.reason);
    return;
  }

  enviarNotificacaoDiscordNpsAtendimento(dados);

  Logger.log('✅ Teste NPS Atendimento enviado com dados reais da linha ' + row);
}

function testarEnvioFinanciamentoDiscordLinha3() {
  const row = 3;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABA_OUVIDORIA);

  if (!sheet) {
    throw new Error('Aba "' + ABA_OUVIDORIA + '" não encontrada.');
  }

  const logDiscordCol = ensureDiscordLogColumn_(sheet);
  const dados = coletarDadosNps(sheet, row);

  Logger.log(JSON.stringify(dados, null, 2));

  const setorOk = isSetorFinanciamentoDiscord(dados.setor);
  Logger.log('Teste Financiamento | setor="' + dados.setor + '" | setorOk=' + setorOk);

  if (!setorOk) {
    Logger.log('Não enviou Financiamento: setor não é financiamento.');
    return;
  }

  const validacao = validarDadosDiscordFinanciamentoDireto_(dados);
  if (!validacao.ok) {
    Logger.log('Não enviou Financiamento: ' + validacao.reason);
    sheet.getRange(row, logDiscordCol).setValue('Não enviou financiamento (teste): ' + validacao.reason);
    return;
  }

  enviarNotificacaoDiscordFinanciamentoDireto_(dados);
  sheet.getRange(row, logDiscordCol).setValue('OK (teste): financiamento enviado ao Discord');
  Logger.log('✅ Teste Financiamento enviado com dados reais da linha ' + row);
}

function diagnosticarLeituraDiscordLinha(row) {
  const targetRow = Number(row || 3);
  if (!targetRow || targetRow < 2) throw new Error('Linha inválida: ' + row);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABA_OUVIDORIA);

  if (!sheet) {
    throw new Error('Aba "' + ABA_OUVIDORIA + '" não encontrada.');
  }

  const cols = {
    A_IMOVEL: 1,
    B_PROPONENTE: 2,
    C_TELEFONE: 3,
    Q_DESCRICAO: 17,
    R_ACAO: 18,
    S_CAUSA_RAIZ: 19,
    T_SETOR: 20,
    U_OWNER: 21,
    V_EXECUTOR: 22,
    W_LIDER: 23,
    X_ORIGEM: 24
  };

  const snapshot = {};
  Object.keys(cols).forEach(function(k) {
    snapshot[k] = sheet.getRange(targetRow, cols[k]).getDisplayValue();
  });

  Logger.log('COLUMN_MAPPING=' + JSON.stringify(COLUMN_MAPPING));
  Logger.log('Snapshot linha ' + targetRow + '=' + JSON.stringify(snapshot, null, 2));

  const executorLido = lerExecutorDaLinha_(sheet, targetRow);
  const setorLido = lerSetorDaLinha_(sheet, targetRow);
  const origemLida = lerOrigemDaLinha_(sheet, targetRow);

  Logger.log(
    'Leituras helpers | row=' +
    targetRow +
    ' | executor="' + executorLido + '"' +
    ' | setor="' + setorLido + '"' +
    ' | origem="' + origemLida + '"'
  );

  const dados = coletarDadosNps(sheet, targetRow);
  const check = {
    codImovel: campoObrigatorioCodigoImovelPreenchido_(dados.codImovel),
    nomeProponente: campoObrigatorioPreenchido_(dados.nomeProponente),
    executor: campoObrigatorioPreenchido_(dados.executor),
    descricaoReclamacao: campoObrigatorioPreenchido_(dados.descricaoReclamacao),
    acaoEfetiva: campoObrigatorioPreenchido_(dados.acaoEfetiva),
    setor: campoObrigatorioPreenchido_(dados.setor),
    origem: campoObrigatorioPreenchido_(dados.origem)
  };

  Logger.log('coletarDadosNps=' + JSON.stringify(dados, null, 2));
  Logger.log('campoObrigatorioPreenchido checks=' + JSON.stringify(check));

  const validacaoFin = validarDadosDiscordFinanciamentoDireto_(dados);
  Logger.log('validarDadosDiscordFinanciamentoDireto_=' + JSON.stringify(validacaoFin));

  const logDiscordCol = ensureDiscordLogColumn_(sheet);
  sheet.getRange(targetRow, logDiscordCol).setValue(
    'DIAG: execOk=' + (check.executor ? '1' : '0') +
    ' | exec="' + String(executorLido || '') + '"' +
    ' | setor="' + String(setorLido || '') + '"' +
    ' | origem="' + String(origemLida || '') + '"' +
    (validacaoFin && validacaoFin.ok ? '' : ' | fin=' + String((validacaoFin && validacaoFin.reason) || ''))
  );
}

function criarTriggerInstalavel() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'aoEditarCelula') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('aoEditarCelula')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log('✅ Trigger instalável criado com sucesso!');
}

function listarTriggersDiscord() {
  const triggers = ScriptApp.getProjectTriggers();
  const rows = triggers.map(function(t) {
    const fn = t.getHandlerFunction && t.getHandlerFunction();
    const type = t.getEventType && t.getEventType();
    return { handler: fn, eventType: String(type) };
  });
  Logger.log('Triggers instalados: ' + JSON.stringify(rows));
  return rows;
}

// Remove triggers duplicados do handler `aoEditarCelula` (onEdit).
// Útil quando `installTriggers` e `criarTriggerInstalavel` foram executados várias vezes.
function limparTriggersDuplicadosDiscord() {
  const triggers = ScriptApp.getProjectTriggers();
  const discordOnEdits = [];

  triggers.forEach(function(t) {
    try {
      const fn = t.getHandlerFunction && t.getHandlerFunction();
      const type = t.getEventType && t.getEventType();
      if (fn === 'aoEditarCelula' && String(type).indexOf('ON_EDIT') !== -1) {
        discordOnEdits.push(t);
      }
    } catch (_) {}
  });

  if (discordOnEdits.length <= 1) {
    Logger.log('✅ Discord: nenhum trigger duplicado encontrado. count=' + discordOnEdits.length);
    return { ok: true, deleted: 0, kept: discordOnEdits.length };
  }

  // Mantém 1 e remove o restante.
  for (let i = 1; i < discordOnEdits.length; i++) {
    ScriptApp.deleteTrigger(discordOnEdits[i]);
  }

  Logger.log('✅ Discord: triggers duplicados removidos. kept=1 deleted=' + (discordOnEdits.length - 1));
  return { ok: true, deleted: discordOnEdits.length - 1, kept: 1 };
}







function limparLogDiscordLinha2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ABA_OUVIDORIA);
  const logCol = ensureDiscordLogColumn_(sheet);

  sheet.getRange(2, logCol).clearContent();

  Logger.log('Log Discord da linha 2 limpo.');
}



function diagnosticarFuncoesFinanciamentoDiscord() {
  Logger.log(
    'coletarDadosOuvidoria: ' +
    typeof coletarDadosOuvidoria
  );

  Logger.log(
    'validarDadosDiscordFinanciamento: ' +
    typeof validarDadosDiscordFinanciamento
  );

  Logger.log(
    'enviarNotificacaoDiscord: ' +
    typeof enviarNotificacaoDiscord
  );

  Logger.log(
    'isSetorFinanciamentoDiscord: ' +
    typeof isSetorFinanciamentoDiscord
  );
}
