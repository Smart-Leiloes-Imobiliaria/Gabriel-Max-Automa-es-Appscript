

const CONFIG = {
  EQUIPE_SHEET_NAME: 'Equipe',
  SHEET_NAME: 'Ouvidoria',

  // Layout da aba Ouvidoria (40 colunas).
  COL_IMOVEL: 1,                         // A - Imóvel
  COL_PROPONENTE: 2,                     // B - Proponente Principal
  COL_TELEFONE: 3,                       // C - Telefone Cliente
  COL_DATA_ABERT: 4,                     // D - Data Abertura Ouvidoria
  COL_DATA_CONTATO: 5,                   // E - Data de Contato
  COL_CONTATO_REALIZADO: 6,              // F - Contato Realizado?
  COL_ANO_MES_ABERTURA: 7,               // G - Ano/mes abertura
  COL_DATA_CONCLUSAO: 8,                 // H - Data de Conclusão
  COL_TEMPO_CONCLUSAO: 9,                // I - Tempo de conclusao (dias)
  COL_DATA_CRIACAO_ATIVIDADE: 10,        // J - Data da criação da atividade
  COL_DATA_ACAO_EFETIVA: 11,             // K - Data da Ação Efetiva
  COL_TEMPO_CONCLUSAO_ACAO_EFETIVA: 12,  // L - Tempo de Conclusão da Ação Efetiva
  COL_RECORRENCIA: 13,                   // M - Recorrência Imóvel
  COL_RECORRENCIA_ASSUNTO: 14,           // N - Recorrência Assunto
  COL_RECORRENCIA_NPS: 15,               // O - Recorrência NPS
  COL_CRITICIDADE: 16,                   // P - Criticidade
  COL_STATUS: 17,                        // Q - Status
  COL_DESC: 18,                          // R - Descrição da reclamação
  COL_ACAO: 19,                          // S - Ação efetiva
  COL_CAUSA_RAIZ: 20,                    // T - Causa raiz
  COL_SETOR: 21,                         // U - Setor
  COL_OWNER: 22,                         // V - Proprietário
  COL_PROPRIETARIO: 22,                  // V - Alias legado de Proprietário
  COL_EXEC: 23,                          // W - Executor
  COL_LIDER: 24,                         // X - Líder
  COL_ORIGEM: 25,                        // Y - Origem
  COL_DIA1_ATUALIZACOES: 26,             // Z
  COL_DIA1_CONFORMIDADE: 27,             // AA
  COL_DIA2_ATUALIZACOES: 28,             // AB
  COL_DIA2_CONFORMIDADE: 29,             // AC
  COL_DIA3_ATUALIZACOES: 30,             // AD
  COL_DIA3_CONFORMIDADE: 31,             // AE
  COL_DIA4_ATUALIZACOES: 32,             // AF
  COL_DIA4_CONFORMIDADE: 33,             // AG
  COL_DIA5_ATUALIZACOES: 34,             // AH
  COL_DIA5_CONFORMIDADE: 35,             // AI
  COL_TEMPO_CONCLUSAO_EXECUTOR: 36,      // AJ
  COL_NOTIF_HASH: 37,                    // AK
  COL_LOG_AUTOMACAO: 38,                 // AL
  COL_LOG_ATIVIDADES: 39,                // AM
  COL_LOG_DISCORD: 40,                   // AN

  // Layout da aba Equipe:
  // Linha 1: aviso ignorado | Linha 2: cabecalho | Linha 3+: dados.
  // A Setor | B Nome | C E-mail | D Cargo | E Horário de entrada |
  // F Horário de saída | G Tutor | H Líder | I Coordenador.
  EQUIPE_HEADER_ROW: 2,
  EQUIPE_DATA_START_ROW: 3,
  EQUIPE_COL_NOME: 2,                  // B - NOME
  EQUIPE_COL_LIDER: 8,                 // H - LIDER

  SETOR_UPDATE_WAIT_MS: 8000,
  PRIORITY_FIELD_KEY: "priority",
  PRIORITY_HIGH_OPTION_ID: 27,

  LOG_HEADER: "Log atividades",

  ACTIVITY_TYPE: {
    KEY_OVERRIDE: "deadline"
  },


  PIPEDRIVE_EXECUTOR_OPTIONS: {
    '48702809ea42b44effdcc2ca4a5b64b3ac0a5c51': {
      '1037': 'Smart',
      '1038': 'Cliente',
      '1443': 'Terceiro'
    },

    '1dbb1d3c497001898a92edd0a1799d19485bf26e': {
      '412': 'Parceiro',
      '1494': 'Terceiro Substituto',
      '359': 'Smart',
      '683': 'Gerente externo (FGTS)',
      '500': 'Cartório/CCA Externo',
      '2438': 'CCA Smart Caixa',
      '358': 'Cartório/CCA Parceiro (não utilizar)'
    },

    '71dd30861def8dbfba689db5aace5db9d6193ef1': {
      '322': 'Smart',
      '323': 'Cliente'
    },

    'beaa2e2d9639559f5879ddccfeb665eb171a4a90': {
      '1035': 'Smart',
      '1036': 'Cliente',
      '1442': 'Terceiro'
    },

    '90cec4ad4796cbca9a16f4d3626b643cc0e090d9': {
      '498': 'Terceiro',
      '1495': 'Terceiro Substituto',
      '318': 'Smart',
      '317': 'Cliente (com acompanhamento)',
      '1492': 'Cliente (sem acompanhamento)',
      '319': 'Cartório Externo',
      '497': 'Cartório Parceiro (não utilizar)'
    }
  }
};

function isCodigoImovelManual_(codigoImovel) {
  return String(codigoImovel || '')
    .trim()
    .toUpperCase() === 'N/A';
}

const EXECUTORES = [
  { tipo: 'contrato',     fieldKey: '1dbb1d3c497001898a92edd0a1799d19485bf26e', coluna: CONFIG.COL_EXECUTOR_CONTRATO },
  { tipo: 'itbi',         fieldKey: '90cec4ad4796cbca9a16f4d3626b643cc0e090d9', coluna: CONFIG.COL_EXECUTOR_ITBI },
  { tipo: 'titularidade', fieldKey: '03d5b34bd64eb313c521deed73537201ff73951b', coluna: CONFIG.COL_EXECUTOR_TITULARIDADE },
  { tipo: 'registro',     fieldKey: 'ae3bc94d6a98d3509c6803d2b3b6351927a2f5e2', coluna: CONFIG.COL_EXECUTOR_REGISTRO },
  { tipo: 'iptu',         fieldKey: 'beaa2e2d9639559f5879ddccfeb665eb171a4a90', coluna: CONFIG.COL_EXECUTOR_IPTU },
  { tipo: 'condominio',   fieldKey: '48702809ea42b44effdcc2ca4a5b64b3ac0a5c51', coluna: CONFIG.COL_EXECUTOR_CONDOMINIO },
  { tipo: 'desocupacao',  fieldKey: '71dd30861def8dbfba689db5aace5db9d6193ef1', coluna: CONFIG.COL_EXECUTOR_DESOCUPACAO }
];


// lider 
function normalizarExecutorParaBuscaLider_(executorRaw) {
  return String(executorRaw || '')
    .replace(/\(Você\)/gi, '')
    .replace(/^\s*(Interno|Externo)\s*[-–—:]\s*/i, '')
    .replace(/^\s*Propriet[aá]rio\s*[-–—:]\s*/i, '')
    .replace(/^\s*Parceiro\s*[-–—:]\s*/i, '')
    .replace(/^\s*Cart[oó]rio\s*[-–—:]\s*/i, '')
    .replace(/^\s*Interno\s*[-–—:]?\s*CCA\s*[-–—:]?\s*/i, '')
    .replace(/^\s*CCA\s*[-–—:]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolverColunaEquipePorCabecalho_(sheet, aliases, fallbackCol) {
  if (!sheet || sheet.getLastColumn() < 1) return fallbackCol;

  var headerRow = CONFIG.EQUIPE_HEADER_ROW || 1;
  if (sheet.getLastRow() < headerRow) return fallbackCol;

  var headers = sheet
    .getRange(headerRow, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];
  var aliasesNorm = (aliases || []).map(function(alias) {
    return normalizarTextoComparacao_(alias);
  });

  for (var i = 0; i < headers.length; i++) {
    if (aliasesNorm.indexOf(normalizarTextoComparacao_(headers[i])) !== -1) {
      return i + 1;
    }
  }

  Logger.log(
    'Cabeçalho da aba Equipe não encontrado para ' + JSON.stringify(aliases) +
    '. Usando coluna fallback ' + fallbackCol + '.'
  );
  return fallbackCol;
}

function preencherLiderDaLinha_(sheet, row, executorRaw) {
  var cellLider = sheet.getRange(row, CONFIG.COL_LIDER);
  var liderAnterior = String(cellLider.getDisplayValue() || '').trim();
  var fonteLider = 'Executor (W)';

  // No fluxo de parceiro/terceiro, W mantém o parceiro executor e V recebe
  // Pedro Rocha como responsável. Nessa situação, X deve refletir o líder de
  // Pedro na aba Equipe, sem alterar o executor selecionado em W.
  var responsavelRaw = String(
    sheet.getRange(row, CONFIG.COL_OWNER).getDisplayValue() || ''
  ).trim();

  if (normalizarTextoComparacao_(responsavelRaw) === 'pedro rocha') {
    executorRaw = responsavelRaw;
    fonteLider = 'Responsável (V)';
    Logger.log(
      'Linha ' + row +
      ': responsável Pedro Rocha identificado em V; líder será buscado para Pedro na aba Equipe.'
    );
  }

  var executorTexto = normalizarExecutorParaBuscaLider_(executorRaw);

  if (!executorTexto) {
    cellLider.clearContent();
    Logger.log('Linha ' + row + ': executor vazio, não foi possível buscar líder.');
    return;
  }

  var executores = executorTexto
    .split('|')
    .map(function(nome) {
      return String(nome || '').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  if (!executores.length) {
    cellLider.clearContent();
    Logger.log('Linha ' + row + ': nenhum executor válido para buscar líder.');
    return;
  }

  for (var i = 0; i < executores.length; i++) {
    var executorNome = executores[i];
    var lider = buscarLiderNaAbaEquipe_(executorNome, sheet.getParent());

    Logger.log(
      'Linha ' + row +
      ': fonte="' + fonteLider +
      '", executor testado="' + executorNome +
      '", líder encontrado="' + lider +
      '", líder anterior="' + liderAnterior + '"'
    );

    if (!lider) continue;

    // Mantém a validação atual quando ela já aceita o líder encontrado.
    garantirValidacaoPadraoLider_(sheet, row, false);
    var liderValidado = selecionarOpcaoExistenteNaValidacao_(cellLider, lider);

    // Se a lista estiver desatualizada, atualiza pela aba Equipe e tenta uma
    // segunda vez. A validação nunca é alterada sem um líder já encontrado.
    if (!liderValidado) {
      garantirValidacaoPadraoLider_(sheet, row, true);
      SpreadsheetApp.flush();
      liderValidado = selecionarOpcaoExistenteNaValidacao_(cellLider, lider);
    }

    if (liderValidado) {
      cellLider.setValue(liderValidado);
      SpreadsheetApp.flush();

      Logger.log(
        'Linha ' + row +
        ': líder selecionado/preenchido com opção válida: "' + liderValidado + '".'
      );

      return;
    }

    Logger.log(
      'Linha ' + row +
      ': líder "' + lider +
      '" encontrado na aba Equipe, mas não existe como opção válida na célula.'
    );
  }

  // Nunca conserva o líder de um executor anterior quando a nova busca falha.
  cellLider.clearContent();
  Logger.log(
    'Linha ' + row +
    ': nenhum líder foi preenchido para os executores: ' +
    JSON.stringify(executores)
  );
}

function buscarLiderNaAbaEquipe_(nomeExecutor, spreadsheet) {
  var ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var equipeSheet = ss.getSheetByName(CONFIG.EQUIPE_SHEET_NAME);

  if (!equipeSheet) {
throw new Error('Aba "' + CONFIG.EQUIPE_SHEET_NAME + '" não encontrada.');  }

  var lastRow = equipeSheet.getLastRow();
  var dataStartRow = CONFIG.EQUIPE_DATA_START_ROW || 2;

  if (lastRow < dataStartRow) {
    return '';
  }

  var colNome = resolverColunaEquipePorCabecalho_(
    equipeSheet,
    ['NOME'],
    CONFIG.EQUIPE_COL_NOME
  );
  var colLider = resolverColunaEquipePorCabecalho_(
    equipeSheet,
    ['LIDER', 'LÍDER'],
    CONFIG.EQUIPE_COL_LIDER
  );
  var lastCol = Math.max(colNome, colLider);
  var totalRows = lastRow - dataStartRow + 1;
  var values = equipeSheet.getRange(dataStartRow, 1, totalRows, lastCol).getValues();

  var executorNorm = normalizarTextoComparacao_(nomeExecutor);

  var correspondenciasExatas = [];

  for (var i = 0; i < values.length; i++) {
    var nomeEquipe = String(values[i][colNome - 1] || '').trim();
    var liderEquipe = String(values[i][colLider - 1] || '').trim();

    if (!nomeEquipe || !liderEquipe) continue;

    var nomeEquipeNorm = normalizarTextoComparacao_(nomeEquipe);

    if (nomeEquipeNorm === executorNorm) {
      correspondenciasExatas.push({
        row: i + dataStartRow,
        nome: nomeEquipe,
        lider: liderEquipe
      });
    }
  }

  if (!correspondenciasExatas.length) {
    Logger.log(
      'Nenhuma correspondência exata na aba Equipe para "' + nomeExecutor + '".'
    );
    return '';
  }

  var lideresExatos = correspondenciasExatas
    .map(function(item) { return item.lider; })
    .filter(function(lider, index, arr) {
      var liderNorm = normalizarTextoComparacao_(lider);
      return arr.findIndex(function(outro) {
        return normalizarTextoComparacao_(outro) === liderNorm;
      }) === index;
  });

  if (lideresExatos.length === 1) return lideresExatos[0];

  Logger.log(
    'Cadastro duplicado e ambíguo na aba Equipe para "' + nomeExecutor + '": ' +
    JSON.stringify(correspondenciasExatas)
  );

  return '';
}
// preenche o lider de acordo com a opçaõ prensente na planilha 
function garantirValidacaoPadraoLider_(sheet, row, atualizarPelaEquipe) {
  if (!CONFIG.COL_LIDER) return;

  var cell = sheet.getRange(row, CONFIG.COL_LIDER);
  var rule = cell.getDataValidation();

  if (atualizarPelaEquipe) {
    var ruleEquipe = criarValidacaoLiderAPartirDaEquipe_(sheet.getParent());
    if (ruleEquipe) {
      cell.setDataValidation(ruleEquipe);
      Logger.log('Validação do líder atualizada pela aba Equipe na linha ' + row);
      return;
    }
  }

  if (rule) return;

  var rulePadrao = buscarValidacaoPadraoNaColuna_(sheet, CONFIG.COL_LIDER, row);

  if (!rulePadrao) {
    rulePadrao = criarValidacaoLiderAPartirDaEquipe_(sheet.getParent());
  }

  if (rulePadrao) {
    cell.setDataValidation(rulePadrao);
    Logger.log('Validação padrão do líder aplicada na linha ' + row);
  } else {
    Logger.log('Não foi possível criar validação padrão para líder na linha ' + row);
  }
}

// Quando a coluna X ainda não possuir validação, cria a lista a partir dos
// líderes cadastrados na aba Equipe. Assim a própria validação também segue a
// mesma fonte de verdade usada no preenchimento automático.
function criarValidacaoLiderAPartirDaEquipe_(spreadsheet) {
  var ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var equipeSheet = ss.getSheetByName(CONFIG.EQUIPE_SHEET_NAME);
  var dataStartRow = CONFIG.EQUIPE_DATA_START_ROW || 2;
  if (!equipeSheet || equipeSheet.getLastRow() < dataStartRow) return null;

  var totalRows = equipeSheet.getLastRow() - dataStartRow + 1;
  var colLider = resolverColunaEquipePorCabecalho_(
    equipeSheet,
    ['LIDER', 'LÍDER'],
    CONFIG.EQUIPE_COL_LIDER
  );
  var lideres = equipeSheet
    .getRange(dataStartRow, colLider, totalRows, 1)
    .getDisplayValues()
    .flat()
    .map(function(lider) { return String(lider || '').trim(); })
    .filter(Boolean)
    .filter(function(lider, index, lista) { return lista.indexOf(lider) === index; });

  if (!lideres.length) return null;

  return SpreadsheetApp.newDataValidation()
    .requireValueInList(lideres, true)
    .setAllowInvalid(false)
    .build();
}

function buscarValidacaoPadraoNaColuna_(sheet, col, rowAtual) {
  var templateRow = Number(CONFIG.TEMPLATE_ROW || 2);

  var ruleTemplate = sheet.getRange(templateRow, col).getDataValidation();
  if (ruleTemplate) return ruleTemplate;

  for (var r = rowAtual - 1; r >= 2; r--) {
    var rule = sheet.getRange(r, col).getDataValidation();
    if (rule) return rule;
  }

  return null;
}

function selecionarOpcaoExistenteNaValidacao_(cell, valorDesejado) {
  if (!valorDesejado) return '';

  var rule = cell.getDataValidation();

  if (!rule) {
    Logger.log('Célula sem validação. Não será escrito valor fora do padrão.');
    return '';
  }

  var criteriaType = rule.getCriteriaType();
  var criteriaValues = rule.getCriteriaValues();

  var opcoes = [];

  if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    opcoes = criteriaValues[0] || [];
  } else if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    var range = criteriaValues[0];

    if (range) {
      opcoes = range
        .getDisplayValues()
        .flat()
        .map(function(v) {
          return String(v || '').trim();
        })
        .filter(Boolean);
    }
  } else {
    Logger.log(
      'Validação da célula de líder não é lista nem intervalo. Tipo: ' + criteriaType
    );
    return '';
  }

  var desejadoNorm = normalizarTextoComparacao_(valorDesejado);

  for (var i = 0; i < opcoes.length; i++) {
    if (String(opcoes[i]).trim() === String(valorDesejado).trim()) {
      return opcoes[i];
    }
  }

  for (var j = 0; j < opcoes.length; j++) {
    if (normalizarTextoComparacao_(opcoes[j]) === desejadoNorm) {
      return opcoes[j];
    }
  }

  Logger.log('Valor "' + valorDesejado + '" não encontrado nas opções válidas da célula.');
  return '';
}

function normalizarTextoComparacao_(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[-_\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// GATILHO

function onEdit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    if (sheet.getName() !== CONFIG.SHEET_NAME) return;

    var row = e.range.getRow();
    var col = e.range.getColumn();

    if (row < 2) return;
    if (col !== CONFIG.COL_IMOVEL) return;

    var imovel = sheet.getRange(row, CONFIG.COL_IMOVEL).getValue();
    var setor = sheet.getRange(row, CONFIG.COL_SETOR).getValue();

    if (!imovel || !setor) return;

    atualizarRecorrenciaAssunto_(sheet, row);

  } catch (error) {
    Logger.log('Erro no onEdit: ' + error);
  }
}

// PIPEDRIVE



function testarTipoAtividadeOuvidoria() {
  Logger.log("CONFIG.ACTIVITY_TYPE:");
  Logger.log(JSON.stringify(CONFIG.ACTIVITY_TYPE));

  var key = resolveActivityTypeKeyFromSetor_("Triagem");

  Logger.log("Tipo resolvido:");
  Logger.log(key);
}



function preencherContextoOuvidoriaNaPlanilha_(sheet, row, deal) {
  try {
    var codigoImovel = String(sheet.getRange(row, CONFIG.COL_IMOVEL || 1).getDisplayValue() || '').trim();
    if (typeof isCodigoImovelManual_ === 'function' && isCodigoImovelManual_(codigoImovel)) {
      Logger.log('Ouvidoria | Código do imóvel = "N/A": ignorando preenchimento automático via Pipedrive/Drive. Linha: ' + row);
      return;
    }
  } catch (_) {}

  var contexto = new OuvidoriaContext(
    sheet,
    row,
    deal,
    CONFIG,
    EXECUTORES
  ).build();

  sheet.getRange(row, CONFIG.COL_PROPONENTE).setValue(contexto.proponente || '');
  sheet.getRange(row, CONFIG.COL_PROPRIETARIO).setValue(contexto.proprietario.nome || '');

  EXECUTORES.forEach(function(def) {
    if (!def.coluna) {
      Logger.log('Coluna não configurada para executor: ' + def.tipo);
      return;
    }

    var executor = contexto.executores[def.tipo];
    var nomeExecutor = executor && executor.nome ? executor.nome : '';

    sheet.getRange(row, def.coluna).setValue(nomeExecutor);
  });

  atualizarRecorrenciaAssunto_(sheet, row);

  var setorAtual = sheet.getRange(row, CONFIG.COL_SETOR).getDisplayValue();


  var executorFinal = sheet.getRange(row, CONFIG.COL_EXEC).getDisplayValue();

  if (executorFinal) {
    preencherLiderDaLinha_(sheet, row, executorFinal);
  }
}

function getContextoOuvidoria_(sheet, row, deal) {
  var rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var dealData = deal.data || deal.item || deal;

  var proponente = dealData['dfe3b8f6919638e6d107758dbee74ed1be341803'];
  var recorrencia = (rowValues[CONFIG.COL_DESC - 1] || '').toString().trim();

  var proprietarioId = extractDealOwnerId_(dealData);
  var proprietarioNome = null;

  if (dealData.owner && dealData.owner.name) {
    proprietarioNome = dealData.owner.name;
  } else if (dealData.owner_id && dealData.owner_id.name) {
    proprietarioNome = dealData.owner_id.name;
  } else if (dealData.user_id && dealData.user_id.name) {
    proprietarioNome = dealData.user_id.name;
  }

  var executores = {};

  EXECUTORES.forEach(function(def) {
    executores[def.tipo] = resolveExecutor_(dealData, def.fieldKey);
  });

  return {
    proponente: proponente || null,
    recorrencia: recorrencia || null,
    proprietario: {
      id: proprietarioId || null,
      nome: proprietarioNome || null
    },
    executores: executores
  };
}

// RECORRÊNCIA

function atualizarRecorrenciaAssunto_(sheet, row) {
  var recorrenciaAssunto = getRecorrenciaAssunto_(sheet, row);
  sheet.getRange(row, CONFIG.COL_RECORRENCIA_ASSUNTO).setValue(recorrenciaAssunto);
}

function getRecorrenciaAssunto_(sheet, row) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var lastCol = Math.max(CONFIG.COL_IMOVEL, CONFIG.COL_SETOR);
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var current = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

  var imovelAtual = String(current[CONFIG.COL_IMOVEL - 1] || '').trim();
  var setorAtual = normalizeText_(current[CONFIG.COL_SETOR - 1]);

  if (!imovelAtual || !setorAtual) return 0;

  var total = 0;

  for (var i = 0; i < data.length; i++) {
    var linha = data[i];
    var imovel = String(linha[CONFIG.COL_IMOVEL - 1] || '').trim();
    var setor = normalizeText_(linha[CONFIG.COL_SETOR - 1]);

    if (!imovel) continue;
    if (imovel !== imovelAtual) continue;
    if (setor !== setorAtual) continue;

    total++;
  }

  return total;
}

function getRecorrenciasOuvidoria_(sheet, row) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { recorrencia_imovel: 0, recorrencia_assunto: 0 };

  var lastCol = Math.max(CONFIG.COL_IMOVEL, CONFIG.COL_SETOR);
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var current = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

  var imovelAtual = String(current[CONFIG.COL_IMOVEL - 1] || '').trim();
  var setorAtual = normalizeText_(current[CONFIG.COL_SETOR - 1]);

  if (!imovelAtual || !setorAtual) {
    return { recorrencia_imovel: 0, recorrencia_assunto: 0 };
  }

  var totalImovel = 0;
  var totalSetor = 0;

  for (var i = 0; i < data.length; i++) {
    var linha = data[i];
    var imovel = String(linha[CONFIG.COL_IMOVEL - 1] || '').trim();
    var setor = normalizeText_(linha[CONFIG.COL_SETOR - 1]);

    if (!imovel || imovel !== imovelAtual) continue;

    totalImovel++;
    if (setor === setorAtual) totalSetor++;
  }

  return {
    recorrencia_imovel: totalImovel,
    recorrencia_assunto: totalSetor
  };
}

// RECÁLCULO EM LOTE

function recalcularRecorrenciaAssuntoOuvidoria() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error('A aba "' + CONFIG.SHEET_NAME + '" não foi encontrada.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  for (var row = 2; row <= lastRow; row++) {
    atualizarRecorrenciaAssunto_(sheet, row);
  }

  Logger.log('Recálculo concluído: ' + (lastRow - 1) + ' linhas processadas.');
}

// UTILITÁRIOS

function normalizeText_(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractDealOwnerId_(deal) {
  if (deal.owner_id && typeof deal.owner_id === 'object' && deal.owner_id.value) {
    return String(deal.owner_id.value);
  }
  if (deal.owner_id && typeof deal.owner_id !== 'object') {
    return String(deal.owner_id);
  }
  if (deal.user_id && deal.user_id.id) {
    return String(deal.user_id.id);
  }
  return null;
}

function resolveExecutor_(deal, fieldKey) {
  var raw = deal[fieldKey];

  if (!raw) {
    return {
      nome: null,
      tipo: null,
      user_id: null
    };
  }

  var valor = '';

  if (typeof raw === 'object' && raw !== null) {
    valor = String(raw.name || raw.label || raw.value || '').trim();
  } else {
    valor = String(raw).trim();
  }

  if (/^\d+$/.test(valor)) {
    var label = getDealFieldOptionLabel_(fieldKey, valor);
    if (label) valor = label;
  }

  var tipo = null;
  if (/interno/i.test(valor) || /smart/i.test(valor)) {
    tipo = 'interno';
  } else if (/externo/i.test(valor) || /cca/i.test(valor)) {
    tipo = 'externo';
  }

  var userId = null;
  if (tipo === 'interno') {
    userId = resolveUserIdFromName_(valor);
  }

  return {
    nome: valor || null,
    tipo: tipo,
    user_id: userId
  };
}

function getDealFieldOptionLabel_(fieldKey, optionId) {
  var options = CONFIG.PIPEDRIVE_EXECUTOR_OPTIONS || {};
  var fieldOptions = options[fieldKey] || null;

  if (!fieldOptions) return null;

  var key = String(optionId).trim();
  return fieldOptions[key] || null;
}
