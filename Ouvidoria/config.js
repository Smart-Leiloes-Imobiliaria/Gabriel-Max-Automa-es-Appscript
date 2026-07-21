

const CONFIG = {
  EQUIPE_SHEET_NAME: 'Equipe',
  SHEET_NAME: 'Ouvidoria',

  COL_IMOVEL: 1,                  // A - Imovel
  COL_PROPONENTE: 2,              // B - Proponente Principal
  COL_TELEFONE: 3,                // C - Telefone do cliente
  COL_DATA_ABERT: 4,              // E - Data Abertura Ouvidoria

  COL_RECORRENCIA: 12,            // L - Recorrência Imóvel
  COL_RECORRENCIA_ASSUNTO: 13,    // M - Recorrência Assunto
  COL_RECORRENCIA_NPS: 14,        // N - Recorrência NPS

  COL_DESC: 17,                   // Q - Descrição da reclamação
  COL_ACAO: 18,                   // R - Ação efetiva

  COL_SETOR: 20,                  // T - Setor
  COL_OWNER: 21,                  // U - Proprietário/Co-proprietário
  COL_EXEC: 22,                   // V - Executor
  COL_LIDER: 23,                  // W - Líder
  COL_ORIGEM: 24,                 // X - Origem

  EQUIPE_COL_NOME: 2,
  EQUIPE_COL_LIDER: 5,

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
      '412': 'Terceiro',
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
    .replace(/^(Interno|Externo)\s*[-–—:]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function preencherLiderDaLinha_(sheet, row, executorRaw) {
  // No fluxo de parceiro/terceiro, V mantém o parceiro executor e U recebe
  // Pedro Rocha como responsável. Nessa situação, W deve refletir o líder de
  // Pedro na aba Equipe, sem alterar o executor selecionado em V.
  var responsavelRaw = String(
    sheet.getRange(row, CONFIG.COL_OWNER).getDisplayValue() || ''
  ).trim();

  if (normalizarTextoComparacao_(responsavelRaw) === 'pedro rocha') {
    executorRaw = responsavelRaw;
    Logger.log(
      'Linha ' + row +
      ': responsável Pedro Rocha identificado em U; líder será buscado para Pedro na aba Equipe.'
    );
  }

  var executorTexto = normalizarExecutorParaBuscaLider_(executorRaw);

  if (!executorTexto) {
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
    Logger.log('Linha ' + row + ': nenhum executor válido para buscar líder.');
    return;
  }

  garantirValidacaoPadraoLider_(sheet, row);
  SpreadsheetApp.flush();

  var cellLider = sheet.getRange(row, CONFIG.COL_LIDER);

  for (var i = 0; i < executores.length; i++) {
    var executorNome = executores[i];
    var lider = buscarLiderNaAbaEquipe_(executorNome);

    Logger.log(
      'Linha ' + row +
      ': executor testado="' + executorNome +
      '", líder encontrado="' + lider + '"'
    );

    if (!lider) continue;

    var liderValidado = selecionarOpcaoExistenteNaValidacao_(cellLider, lider);

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

  Logger.log(
    'Linha ' + row +
    ': nenhum líder foi preenchido para os executores: ' +
    JSON.stringify(executores)
  );
}

// Exceção de negócio exclusiva para Financiamento: a coluna W deve registrar
// Kauã Amorim. Diferente do fluxo geral, não consulta o líder do executor na
// aba Equipe, pois Kauã é o responsável definido para este setor.
function preencherLiderFinanciamentoDaLinha_(sheet, row) {
  var liderNome = 'Kauã Amorim';
  garantirValidacaoPadraoLider_(sheet, row);
  SpreadsheetApp.flush();

  var cellLider = sheet.getRange(row, CONFIG.COL_LIDER);
  var liderValidado = selecionarOpcaoExistenteNaValidacao_(cellLider, liderNome);

  if (liderValidado) {
    cellLider.setValue(liderValidado);
    Logger.log('Linha ' + row + ': Financiamento — líder definido como "' + liderValidado + '".');
    return;
  }

  Logger.log(
    'Linha ' + row + ': Financiamento — "' + liderNome +
    '" não está disponível na validação da coluna de líder.'
  );
}

function buscarLiderNaAbaEquipe_(nomeExecutor) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var equipeSheet = ss.getSheetByName(CONFIG.EQUIPE_SHEET_NAME);

  if (!equipeSheet) {
throw new Error('Aba "' + CONFIG.EQUIPE_SHEET_NAME + '" não encontrada.');  }

  var lastRow = equipeSheet.getLastRow();

  if (lastRow < 2) {
    return '';
  }

  var lastCol = Math.max(CONFIG.EQUIPE_COL_NOME
, CONFIG.EQUIPE_COL_LIDER);
  var values = equipeSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var executorNorm = normalizarTextoComparacao_(nomeExecutor);

  // Prioriza correspondência exata. A busca parcial é mantida apenas como
  // compatibilidade e só é aceita quando não há ambiguidade.
  var correspondenciasParciais = [];

  for (var i = 0; i < values.length; i++) {
    var nomeEquipe = String(values[i][CONFIG.EQUIPE_COL_NOME
 - 1] || '').trim();
    var liderEquipe = String(values[i][CONFIG.EQUIPE_COL_LIDER - 1] || '').trim();

    if (!nomeEquipe || !liderEquipe) continue;

    var nomeEquipeNorm = normalizarTextoComparacao_(nomeEquipe);

    if (nomeEquipeNorm === executorNorm) return liderEquipe;

    if (
      nomeEquipeNorm.indexOf(executorNorm) !== -1 ||
      executorNorm.indexOf(nomeEquipeNorm) !== -1
    ) correspondenciasParciais.push(liderEquipe);
  }

  var lideresParciais = correspondenciasParciais.filter(function(lider, index, arr) {
    return arr.indexOf(lider) === index;
  });

  if (lideresParciais.length === 1) return lideresParciais[0];

  if (lideresParciais.length > 1) {
    Logger.log(
      'Busca de líder ambígua na aba Equipe para "' + nomeExecutor + '": ' +
      JSON.stringify(lideresParciais)
    );
  }

  return '';
}
// preenche o lider de acordo com a opçaõ prensente na planilha 
function garantirValidacaoPadraoLider_(sheet, row) {
  if (!CONFIG.COL_LIDER) return;

  var cell = sheet.getRange(row, CONFIG.COL_LIDER);
  var rule = cell.getDataValidation();

  if (rule) return;

  var rulePadrao = buscarValidacaoPadraoNaColuna_(sheet, CONFIG.COL_LIDER, row);

  if (!rulePadrao) {
    rulePadrao = criarValidacaoLiderAPartirDaEquipe_();
  }

  if (rulePadrao) {
    cell.setDataValidation(rulePadrao);
    Logger.log('Validação padrão do líder aplicada na linha ' + row);
  } else {
    Logger.log('Não foi possível criar validação padrão para líder na linha ' + row);
  }
}

// Quando a coluna W ainda não possuir validação, cria a lista a partir dos
// líderes cadastrados na aba Equipe. Assim a própria validação também segue a
// mesma fonte de verdade usada no preenchimento automático.
function criarValidacaoLiderAPartirDaEquipe_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var equipeSheet = ss.getSheetByName(CONFIG.EQUIPE_SHEET_NAME);
  if (!equipeSheet || equipeSheet.getLastRow() < 2) return null;

  var totalRows = equipeSheet.getLastRow() - 1;
  var lideres = equipeSheet
    .getRange(2, CONFIG.EQUIPE_COL_LIDER, totalRows, 1)
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

  var matches = [];

  for (var k = 0; k < opcoes.length; k++) {
    var opcaoNorm = normalizarTextoComparacao_(opcoes[k]);

    if (
      opcaoNorm.indexOf(desejadoNorm) !== -1 ||
      desejadoNorm.indexOf(opcaoNorm) !== -1
    ) {
      matches.push(opcoes[k]);
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    Logger.log(
      'Mais de uma opção possível encontrada para "' +
      valorDesejado +
      '": ' +
      JSON.stringify(matches)
    );
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


  // Financiamento é delegado a Kauã Amorim na coluna de responsável; o
  // executor permanece manual e o líder é explicitamente Kauã Amorim.
	if (isSetorFinanciamento_(setorAtual)) {
  sheet.getRange(row, CONFIG.COL_EXEC).clearContent();

  preencherLiderFinanciamentoDaLinha_(sheet, row);

  Logger.log(
    'Linha ' + row +
    ': setor Financiamento identificado. Executor final limpo e líder definido como Kauã Amorim.'
  );

  return;
}

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



