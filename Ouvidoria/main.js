// @ts-nocheck
// main.gs
function installTriggers() {
  var ss = SpreadsheetApp.getActive();

  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction && t.getHandlerFunction();

    if (
      fn === 'onEditHandler' ||
      fn === 'onFormSubmitHandler' ||
      fn === 'aoEditarOuvidoria' ||
      fn === 'validarExecutorColunaQ' ||
      fn === 'aoEditarCelula'
    ) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Gatilho principal de criação de atividades no Pipe
  ScriptApp.newTrigger('onEditHandler')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Gatilho de formulario
  ScriptApp.newTrigger('onFormSubmitHandler')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  // Gatilho que preenche proprietário/executor/líder ao mudar setor
  ScriptApp.newTrigger('aoEditarOuvidoria')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Gatilho que envia Discord
  ScriptApp.newTrigger('aoEditarCelula')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log(
    '✅ Gatilhos instalados: onEditHandler, onFormSubmitHandler, aoEditarOuvidoria e aoEditarCelula'
  );
}

function pdDealHasOuvidoriaActivityForAssigneeAndDates_(
  dealId,
  assigneeUserId,
  subjectDia1,
  subjectDia2,
  dueDateDia1,
  dueDateDia2
) {
  try {
    var resp = pdGet_('/activities', {
      deal_id: dealId,
      done: 0,
      limit: 500
    });

    var activities = Array.isArray(resp)
      ? resp
      : (resp && resp.data ? resp.data : []);

    if (!activities || !activities.length) {
      return false;
    }

    for (var i = 0; i < activities.length; i++) {
      var a = activities[i] || {};

      var activityDealId = extractActivityDealId_(a);

      if (activityDealId && Number(activityDealId) !== Number(dealId)) {
        continue;
      }

      var activityUserId = extractActivityUserId_(a);

      if (Number(activityUserId) !== Number(assigneeUserId)) {
        continue;
      }

      var subject = String(a.subject || '').trim();
      var dueDate = String(a.due_date || '').trim();

      var sameDia1 =
        subject === subjectDia1 &&
        dueDate === dueDateDia1;

      var sameDia2 =
        subject === subjectDia2 &&
        dueDate === dueDateDia2;

      if (sameDia1 || sameDia2) {
        return true;
      }
    }

    return false;
  } catch (e) {
    Logger.log(
      'Aviso: não foi possível verificar duplicidade de atividade. ' +
      'dealId=' + dealId +
      ', assigneeUserId=' + assigneeUserId +
      ', erro=' + (e && e.message ? e.message : e)
    );

    return false;
  }
}


// formatação mensagem 

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br_(value) {
  return escapeHtml_(value).replace(/\r?\n/g, '<br>');
}




function prepararLinhaOuvidoriaAntesDaCriacao_(sheet, row) {
  garantirFormulaRecorrencia_(sheet, row);
  garantirValidacaoPadraoLider_(sheet, row);
}

function colToLetter_(col) {
  var n = Number(col || 0);
  if (!n || n < 1) return '';
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function garantirFormulaRecorrencia_(sheet, row) {
  garantirFormulaRecorrenciaImovel_(sheet, row);
  garantirFormulaRecorrenciaAssunto_(sheet, row);
  garantirFormulaRecorrenciaNps_(sheet, row);
}

function garantirFormulaRecorrenciaImovel_(sheet, row) {
  if (!CONFIG.COL_RECORRENCIA) return;

  var cell = sheet.getRange(row, CONFIG.COL_RECORRENCIA);
  var formula = String(cell.getFormula() || '').trim();

  var colImovel = colToLetter_(CONFIG.COL_IMOVEL || 1) || 'A';
  var expected =
    '=IF($' + colImovel + row + '="","",COUNTIF($' + colImovel + '$2:$' + colImovel + row + ',$' + colImovel + row + '))';

  if (formula !== expected) {
    cell.setFormula(expected);
  }
}

function garantirFormulaRecorrenciaNps_(sheet, row) {
  if (!CONFIG.COL_RECORRENCIA_NPS) return;
  if (!CONFIG.COL_ORIGEM) return;

  var cell = sheet.getRange(row, CONFIG.COL_RECORRENCIA_NPS);
  var formula = String(cell.getFormula() || '').trim();

  var colImovel = colToLetter_(CONFIG.COL_IMOVEL || 1) || 'A';
  var colOrigem = colToLetter_(CONFIG.COL_ORIGEM);
  if (!colOrigem) return;

  var expected =
    '=IF(OR($' + colImovel + row + '="",$' + colOrigem + row + '=""),"",IF(OR($' +
    colOrigem + row + '="NPS 1",$' + colOrigem + row + '="NPS 2"),COUNTIFS($' +
    colImovel + '$2:$' + colImovel + row + ',$' + colImovel + row + ',$' +
    colOrigem + '$2:$' + colOrigem + row + ',$' + colOrigem + row + '),""))';

  if (formula !== expected) {
    cell.setFormula(expected);
  }
}

var OUVIDORIA_COL_TELEFONE_ARREMATANTE_ = 3
var PD_FIELD_TELEFONE_ARREMATANTE_KEY_ = '534ddc592e7b7db4b6d6faff0d07f2071684039e'

function preencherTelefoneArrematanteOuvidoria_(sheet, row, options) {
  options = Object.assign({ force: false }, options || {})
  if (!sheet) throw new Error('Sheet inválida.')

  var linha = Number(row)
  if (!linha || linha < 2) throw new Error('Linha inválida: ' + row)

  var telefoneRange = sheet.getRange(linha, OUVIDORIA_COL_TELEFONE_ARREMATANTE_)
  var atual = String(telefoneRange.getDisplayValue() || '').trim()
  if (atual && !options.force) {
    return { ok: true, skipped: true, reason: 'já preenchido', value: atual }
  }

  var codImovel = String(sheet.getRange(linha, 1).getDisplayValue() || '').trim()
  if (!codImovel) {
    return { ok: false, reason: 'código do imóvel vazio (coluna 1)' }
  }

  if (isCodigoImovelManual_ && isCodigoImovelManual_(codImovel)) {
    return { ok: true, skipped: true, reason: 'código do imóvel = N/A (preenchimento manual)' }
  }

  var deal = pdFindDealByPropertyCode_(codImovel)
  if (!deal || !deal.id) {
    return { ok: false, reason: 'deal não encontrado no Pipedrive para o imóvel: ' + codImovel }
  }

  var full = pdGetDealById_(deal.id)
  var telefone =
    (full && full[PD_FIELD_TELEFONE_ARREMATANTE_KEY_]) ||
    (full && full.custom_fields && full.custom_fields[PD_FIELD_TELEFONE_ARREMATANTE_KEY_]) ||
    ''

  telefone = String(telefone || '').trim()
  if (!telefone) {
    return { ok: false, reason: 'telefone do arrematante vazio no Pipedrive (field key: ' + PD_FIELD_TELEFONE_ARREMATANTE_KEY_ + ')' }
  }

  telefoneRange.setValue(telefone)
  return { ok: true, value: telefone, dealId: String(deal.id), codImovel: codImovel }
}

function preencherTelefoneArrematanteLinha(row, options) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME || 'Ouvidoria')
  if (!sheet) throw new Error('Aba "' + (CONFIG.SHEET_NAME || 'Ouvidoria') + '" não encontrada.')
  return preencherTelefoneArrematanteOuvidoria_(sheet, row, options || {})
}


//formula recorrencia se aplicando 
function corrigirTodasFormulasRecorrenciaAssunto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME || 'Ouvidoria');

  if (!sheet) {
    throw new Error('Aba "' + (CONFIG.SHEET_NAME || 'Ouvidoria') + '" não encontrada.');
  }

  var colRecorrenciaAssunto = CONFIG.COL_RECORRENCIA_ASSUNTO;

  if (!colRecorrenciaAssunto) {
    throw new Error('CONFIG.COL_RECORRENCIA_ASSUNTO não está configurado.');
  }

  var primeiraLinhaDados = 2;
  var ultimaLinha = sheet.getLastRow();

  if (ultimaLinha < primeiraLinhaDados) {
    Logger.log('Não há linhas para corrigir.');
    return;
  }

  var formulas = [];

  for (var row = primeiraLinhaDados; row <= ultimaLinha; row++) {
    var formula =
      '=IF(OR($A' + row + '="";$Q' + row + '="");"";COUNTIFS($A$2:$A' + row + ';$A' + row + ';$Q$2:$Q' + row + ';$Q' + row + '))';

    formulas.push([formula]);
  }

  sheet
    .getRange(primeiraLinhaDados, colRecorrenciaAssunto, formulas.length, 1)
    .setFormulas(formulas);

  Logger.log(
    'Corrigidas ' +
    formulas.length +
    ' fórmulas na coluna ' +
    colRecorrenciaAssunto +
    '.'
  );
}
function aplicarFormulasFaltantesRecorrenciaAssunto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME || 'Ouvidoria');

  if (!sheet) {
    throw new Error('Aba "' + (CONFIG.SHEET_NAME || 'Ouvidoria') + '" não encontrada.');
  }

  var colRecorrenciaAssunto = CONFIG.COL_RECORRENCIA_ASSUNTO;

  if (!colRecorrenciaAssunto) {
    throw new Error('CONFIG.COL_RECORRENCIA_ASSUNTO não está configurado.');
  }

  var primeiraLinhaDados = 2;
  var ultimaLinha = sheet.getLastRow();

  if (ultimaLinha < primeiraLinhaDados) {
    Logger.log('Não há linhas para verificar.');
    return;
  }

  var quantidadeLinhas = ultimaLinha - primeiraLinhaDados + 1;

  var range = sheet.getRange(
    primeiraLinhaDados,
    colRecorrenciaAssunto,
    quantidadeLinhas,
    1
  );

  var formulasAtuais = range.getFormulasR1C1();
  var formulasNovas = [];

  var formulaPadraoR1C1 =
    '=IF(OR(RC1="",RC17=""),"",COUNTIFS(R2C1:RC1,RC1,R2C17:RC17,RC17))';

  var totalAplicadas = 0;
  var totalMantidas = 0;

  for (var i = 0; i < quantidadeLinhas; i++) {
    var formulaAtual = String(formulasAtuais[i][0] || '').trim();

    if (formulaAtual) {
      formulasNovas.push([formulaAtual]);
      totalMantidas++;
    } else {
      formulasNovas.push([formulaPadraoR1C1]);
      totalAplicadas++;
    }
  }

  range.setFormulasR1C1(formulasNovas);

  Logger.log(
    'Concluído. Fórmulas aplicadas: ' +
    totalAplicadas +
    '. Fórmulas mantidas: ' +
    totalMantidas +
    '.'
  );
}

function corrigirTodasFormulasRecorrenciaNps() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME || 'Ouvidoria');

  if (!sheet) {
    throw new Error('Aba "' + (CONFIG.SHEET_NAME || 'Ouvidoria') + '" não encontrada.');
  }

  var colRecorrenciaNps = CONFIG.COL_RECORRENCIA_NPS;
  var colOrigem = CONFIG.COL_ORIGEM;

  if (!colRecorrenciaNps) {
    throw new Error('CONFIG.COL_RECORRENCIA_NPS não está configurado.');
  }
  if (!colOrigem) {
    throw new Error('CONFIG.COL_ORIGEM não está configurado.');
  }

  var primeiraLinhaDados = 2;
  var ultimaLinha = sheet.getLastRow();

  if (ultimaLinha < primeiraLinhaDados) {
    Logger.log('Não há linhas para corrigir.');
    return;
  }

  var quantidadeLinhas = ultimaLinha - primeiraLinhaDados + 1;
  var range = sheet.getRange(primeiraLinhaDados, colRecorrenciaNps, quantidadeLinhas, 1);

  var formulaPadraoR1C1 =
    '=IF(OR(RC1="",RC' + colOrigem + '=""),"",IF(OR(RC' + colOrigem + '="NPS 1",RC' + colOrigem + '="NPS 2"),COUNTIFS(R2C1:RC1,RC1,R2C' +
    colOrigem +
    ':RC' +
    colOrigem +
    ',RC' +
    colOrigem +
    '),""))';

  var formulas = [];
  for (var i = 0; i < quantidadeLinhas; i++) {
    formulas.push([formulaPadraoR1C1]);
  }

  range.setFormulasR1C1(formulas);
  Logger.log('Fórmulas de recorrência NPS (coluna N) aplicadas em ' + quantidadeLinhas + ' linhas.');
}
function garantirFormulaRecorrenciaAssunto_(sheet, row) {
  if (!CONFIG.COL_RECORRENCIA_ASSUNTO) return;

  var cell = sheet.getRange(row, CONFIG.COL_RECORRENCIA_ASSUNTO);

  var valor = cell.getDisplayValue();
  var formula = cell.getFormula();

  // Se já tem valor ou fórmula, não sobrescreve.
  if (valor || formula) return;

  var formulaRecorrencia =
    '=IF(OR($A' + row + '="",$Q' + row + '=""),"",COUNTIFS($A$2:$A' + row + ',$A' + row + ',$Q$2:$Q' + row + ',$Q' + row + '))';

  cell.setFormula(formulaRecorrencia);

  Logger.log('Fórmula de recorrência por assunto aplicada na linha ' + row);
}

function buscarFormulaPadraoNaColuna_(sheet, col, rowAtual) {
  var templateRow = Number(CONFIG.TEMPLATE_ROW || 2);

  var formulaTemplate = sheet.getRange(templateRow, col).getFormulaR1C1();
  if (formulaTemplate) return formulaTemplate;

  for (var r = rowAtual - 1; r >= 2; r--) {
    var formula = sheet.getRange(r, col).getFormulaR1C1();
    if (formula) return formula;
  }

  return '';
}

function garantirValidacaoPadraoLider_(sheet, row) {
  if (!CONFIG.COL_LIDER) return;

  var cell = sheet.getRange(row, CONFIG.COL_LIDER);
  var rule = cell.getDataValidation();

  if (rule) return;

  var rulePadrao = buscarValidacaoPadraoNaColuna_(sheet, CONFIG.COL_LIDER, row);

  if (!rulePadrao && typeof criarValidacaoLiderAPartirDaEquipe_ === 'function') {
    rulePadrao = criarValidacaoLiderAPartirDaEquipe_();
  }

  if (rulePadrao) {
    cell.setDataValidation(rulePadrao);
    Logger.log('Validação padrão do líder aplicada na linha ' + row);
  }
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



function extractActivityUserId_(activity) {
  if (!activity) return null;

  var v = activity.user_id;

  if (v && typeof v === 'object' && v.id) {
    return Number(v.id);
  }

  if (v) {
    return Number(v);
  }

  if (activity.assigned_to_user_id) {
    return Number(activity.assigned_to_user_id);
  }

  if (activity.owner_id) {
    if (typeof activity.owner_id === 'object' && activity.owner_id.id) {
      return Number(activity.owner_id.id);
    }

    return Number(activity.owner_id);
  }

  return null;
}

function extractActivityDealId_(activity) {
  if (!activity) return null;

  var v = activity.deal_id;

  if (v && typeof v === 'object' && v.id) {
    return Number(v.id);
  }

  if (v) {
    return Number(v);
  }

  return null;
}

function onFormSubmitHandler(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() !== CONFIG.SHEET_NAME) return;
    var row = e.range.getRow();
    if (row < 2) return;
    processRowCreateActivities_(sheet, row);
  } catch (err) {
    try {
      var sheet2 = e.range.getSheet();
      var logCol2 = ensureLogColumn_(sheet2);
      sheet2.getRange(e.range.getRow(), logCol2).setValue('Erro (FormSubmit): ' + (err.message || err));
    } catch (_) {}
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function onEditHandler(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    if (!e || !e.range) return;

    var range = e.range;
    var sheet = range.getSheet();

    if (sheet.getName() !== CONFIG.SHEET_NAME) return;

    var linhaInicial = range.getRow();
    var linhaFinal = range.getLastRow();

    if (linhaFinal < 2) return;

    // Evita loop em triggers instaláveis: se a própria automação editar o "Log atividades",
    // não reprocessa a linha.
    var logColExisting = findColumnByHeader_(sheet, CONFIG.LOG_HEADER);
    if (logColExisting && rangeIncludesColumn_(range, logColExisting)) return;

    var editouSetor = rangeIncludesColumn_(range, CONFIG.COL_SETOR);

    var editouCampoQuePodeCriarAtividade =
      rangeIncludesColumn_(range, CONFIG.COL_DATA_ABERT) ||
      rangeIncludesColumn_(range, CONFIG.COL_DESC) ||
      rangeIncludesColumn_(range, CONFIG.COL_ACAO) ||
      rangeIncludesColumn_(range, CONFIG.COL_EXEC) ||
      rangeIncludesColumn_(range, CONFIG.COL_OWNER) || 
      rangeIncludesColumn_(range, CONFIG.COL_LIDER) ||
      rangeIncludesColumn_(range, CONFIG.COL_ORIGEM);

    if (editouSetor && !editouCampoQuePodeCriarAtividade) {
      var logColSetor = ensureLogColumn_(sheet);

      for (var r = Math.max(linhaInicial, 2); r <= linhaFinal; r++) {
        sheet.getRange(r, logColSetor).setValue(
          'Aguardando atualização de proprietário/executor/líder/origem após alteração do setor'
        );
      }

      SpreadsheetApp.flush();

      Utilities.sleep(Number(CONFIG.SETOR_UPDATE_WAIT_MS || 10000));

      for (var rowSetor = Math.max(linhaInicial, 2); rowSetor <= linhaFinal; rowSetor++) {
        processRowCreateActivities_(sheet, rowSetor);
      }

      return;
    }

    if (!editouCampoQuePodeCriarAtividade) return;

    for (var row = Math.max(linhaInicial, 2); row <= linhaFinal; row++) {
      processRowCreateActivities_(sheet, row);
    }

  } catch (err) {
    try {
      var sheet2 = e.range.getSheet();
      var logCol2 = ensureLogColumn_(sheet2);
      sheet2.getRange(e.range.getRow(), logCol2).setValue(
        'Erro (OnEdit): ' + (err.message || err)
      );
    } catch (_) {}

    throw err;

  } finally {
    lock.releaseLock();
  }
}

function findColumnByHeader_(sheet, headerName) {
  try {
    var headerRow = 1;
    var lastCol = sheet.getLastColumn();
    if (!lastCol) return 0;
    var headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim() === String(headerName || '').trim()) return i + 1;
    }
    return 0;
  } catch (_) {
    return 0;
  }
}

function rangeIncludesColumn_(range, col) {
  if (!range || !col) return false;

  var colunaInicial = range.getColumn();
  var colunaFinal = range.getLastColumn();

  return colunaInicial <= col && colunaFinal >= col;
}

function processRowCreateActivities_(sheet, row) {
  var logCol = ensureLogColumn_(sheet);

prepararLinhaOuvidoriaAntesDaCriacao_(sheet, row);
SpreadsheetApp.flush();
  var lastNeededCol = Math.max(
    CONFIG.COL_IMOVEL,
    CONFIG.COL_DATA_ABERT,
    CONFIG.COL_DESC,
    CONFIG.COL_ACAO,
    CONFIG.COL_SETOR,
    CONFIG.COL_OWNER,
    CONFIG.COL_EXEC,
    CONFIG.COL_RECORRENCIA, 
    CONFIG.COL_RECORRENCIA_ASSUNTO,
    CONFIG.COL_RECORRENCIA_NPS,
    CONFIG.COL_ORIGEM,
    CONFIG.COL_LIDER,
    logCol
  );

  var rowValues = sheet.getRange(row, 1, 1, lastNeededCol).getValues()[0];
  var existingLog = String(rowValues[logCol - 1] || '');
  if (/^OK:\s*atividades criadas/i.test(existingLog)) return;

  // Reclamações de origem NPS são tratadas exclusivamente no Discord. Este
  // bloqueio acontece antes das demais validações para não exigir executor ou
  // líder em uma linha que jamais deve criar atividade no Pipedrive.
  var origemDaLinha = rowValues[CONFIG.COL_ORIGEM - 1];
  if (isOrigemNps_(origemDaLinha)) {
    sheet.getRange(row, logCol).setValue(
      'Não criou: origem NPS é tratada somente pelo Discord; atividade no Pipe não será criada'
    );
    return;
  }

  var validation = validateRowForActivityCreation_(rowValues);
if (!validation.ok) {
  sheet.getRange(row, logCol).setValue('Não criou: ' + validation.reason);
  return;
}

if (isSetorFinanciamento_(validation.setor)) {
  sheet.getRange(row, logCol).setValue(
    'Não criou: setor Financiamento deve ser tratado manualmente, sem criação de atividade no Pipe'
  );
  return;
}

  var cacheKey = buildCacheKey_(
    sheet.getSheetId(),
    row,
    validation.imovelCode,
    validation.executorRaw,
    validation.descricao,
    validation.acaoEfetiva,
    validation.setor,
    validation.recorrenciaImovel
  );

  if (wasRecentlyProcessed_(cacheKey)) {
    sheet.getRange(row, logCol).setValue('Ignorado: já processado recentemente');
    return;
  }

  if (isCodigoImovelManual_ && isCodigoImovelManual_(validation.imovelCode)) {
    sheet.getRange(row, logCol).setValue(
      'OK: código do imóvel = "N/A" (preenchimento manual). Integração Pipedrive/Drive ignorada; atividades não criadas.'
    );
    markProcessed_(cacheKey);
    return;
  }

  var dealFound = pdFindDealByPropertyCode_(validation.imovelCode);
  if (!dealFound || !dealFound.id) {
    sheet.getRange(row, logCol).setValue('Não criou: deal não encontrado para código ' + validation.imovelCode);
    return;
  }

  var dealId = dealFound.id;
  var fullDeal = pdGetDealById_(dealId);
  var dealOwnerId = extractDealOwnerId_(fullDeal);

  if (!dealOwnerId) {
    sheet.getRange(row, logCol).setValue('Não criou: deal sem owner');
    return;
  }

  var subjectDia1 = 'OUVIDORIA DIA 1 - NOTIFICAR O EXECUTOR OU TERCEIRO';
  var subjectDia2 = 'OUVIDORIA DIA 2 – AÇÃO EFETIVA OU INFORMAÇÃO AO CLIENTE';

  var assigneeUserIds = resolveAssigneeUserIdsFromExecutorColumn_(
  validation.executorRaw,
  validation.ownerSheet,
  validation.setor,
  dealOwnerId
);
  if (!assigneeUserIds || !assigneeUserIds.length) {
    sheet.getRange(row, logCol).setValue('Não criou: não foi possível resolver responsável (assignee)');
    return;
  }

  var activityTypeKey = resolveActivityTypeKeyFromSetor_(validation.setor);
  if (!activityTypeKey) {
    sheet.getRange(row, logCol).setValue('Não criou: tipo de atividade não encontrado');
    return;
  }

  var maxAssignees = Number(CONFIG.COPROP_MAX_ASSIGNEES || 0);
  var uniqueAssignees = uniqueNumbers_(assigneeUserIds);
  if (maxAssignees > 0) uniqueAssignees = uniqueAssignees.slice(0, maxAssignees);

  var today = new Date();
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  var dueDateDia1 = formatDate_(today);
var dueDateDia2 = formatDate_(tomorrow);

var quantidadeOuvidoria = validation.recorrenciaImovel || '(não informado)';

var blocoInfoHtml =
  '<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">' +

    '<p>Olá, tudo bem?</p>' +

    '<p>' +
      '<strong>Reclamação:</strong><br>' +
      nl2br_(validation.descricao) +
    '</p>' +

    '<p>' +
      '<strong>Plano de ação:</strong><br>' +
      nl2br_(validation.acaoEfetiva) +
    '</p>' +

    '<p>' +
      '<strong>Quantidade de ouvidoria para esta demanda:</strong><br>' +
      nl2br_(quantidadeOuvidoria) +
    '</p>';

var noteDia1Base =
  blocoInfoHtml +

    '<hr>' +

    '<p>' +
      '<strong>Orientação Dia 1:</strong><br>' +
      'Notificar o executor ou terceiro responsável e garantir que todas as ações necessárias sejam tomadas até o final do dia.' +
    '</p>' +

    '<p>' +
      'Após a execução, registre a ouvidoria e marque como concluída, informando o devido retorno sobre a ação realizada.' +
    '</p>' +

  '</div>';

var noteDia2Base =
  blocoInfoHtml +

    '<hr>' +

    '<p>' +
      '<strong>Orientação Dia 2:</strong><br>' +
      'Retornar ao cliente até o final do dia com uma ação efetiva ou com informações acerca dos próximos passos.' +
    '</p>' +

    '<p>' +
      'Após a execução, registre a ouvidoria e marque como concluída, informando o devido retorno sobre a ação realizada.' +
    '</p>' +

  '</div>';

  var createdPairs = [];
  var skipped = [];
  var errors = [];

  for (var i = 0; i < uniqueAssignees.length; i++) {
    var uid = uniqueAssignees[i];

var existsForAssignee = pdDealHasOuvidoriaActivityForAssigneeAndDates_(
  dealId,
  uid,
  subjectDia1,
  subjectDia2,
  dueDateDia1,
  dueDateDia2
);    if (existsForAssignee) {
      skipped.push(uid);
      continue;
    }

    var noteDia1 = noteDia1Base;
var noteDia2 = noteDia2Base;

var payloadDia1 = {
  subject: subjectDia1,
  type: activityTypeKey,
  deal_id: dealId,
  user_id: uid,
  due_date: dueDateDia1,
  due_time: '23:59',
  note: noteDia1
};

var payloadDia2 = {
  subject: subjectDia2,
  type: activityTypeKey,
  deal_id: dealId,
  user_id: uid,
  due_date: dueDateDia2,
  due_time: '23:59',
  note: noteDia2
};

payloadDia1[String(CONFIG.PRIORITY_FIELD_KEY)] = CONFIG.PRIORITY_HIGH_OPTION_ID;
payloadDia2[String(CONFIG.PRIORITY_FIELD_KEY)] = CONFIG.PRIORITY_HIGH_OPTION_ID;

    try {
      var activityDia1 = pdCreateActivity_(payloadDia1);
      var activityDia2 = pdCreateActivity_(payloadDia2);

      if (activityDia1 && activityDia1.id && activityDia2 && activityDia2.id) {
        createdPairs.push({ user_id: uid, dia1: activityDia1.id, dia2: activityDia2.id });
      } else {
        errors.push('retorno sem IDs para user_id ' + uid);
      }
    } catch (e) {
      errors.push('user_id ' + uid + ': ' + (e && e.message ? e.message : e));
    }
  }

  if (createdPairs.length || skipped.length) markProcessed_(cacheKey);

  if (createdPairs.length) {
    var idsTxt = createdPairs.map(function(p) { return p.user_id + ' (D1 ' + p.dia1 + ', D2 ' + p.dia2 + ')'; }).join(' | ');
    var msg = 'OK: atividades criadas (' + createdPairs.length + ') [' + idsTxt + ']';
    if (skipped.length) msg += ' | Já existia p/ user_id: ' + skipped.join(', ');
    if (errors.length) msg += ' | Avisos: ' + errors.join(' || ');
    sheet.getRange(row, logCol).setValue(msg);
  } else if (skipped.length) {
    sheet.getRange(row, logCol).setValue('Aviso: já existia para user_id(s): ' + skipped.join(', ') + ' (não recriou)');
  } else {
    sheet.getRange(row, logCol).setValue('Não criou: erro na API (' + (errors.length ? errors.join(' || ') : 'retorno sem IDs') + ')');
  }
}

function prepararLinhaOuvidoriaAntesDaCriacao_(sheet, row) {
  garantirValidacaoPadraoLider_(sheet, row);

  var executorRaw = sheet.getRange(row, CONFIG.COL_EXEC).getDisplayValue();

  if (executorRaw) {
    preencherLiderDaLinha_(sheet, row, executorRaw);
  }

  SpreadsheetApp.flush();
}

function extractDealOwnerId_(deal) {
  if (!deal) return null;
  var v = null;
  if (deal.user_id && typeof deal.user_id === 'object' && deal.user_id.id) v = deal.user_id.id;
  else if (deal.user_id) v = deal.user_id;
  if (!v && deal.owner_id && typeof deal.owner_id === 'object' && deal.owner_id.id) v = deal.owner_id.id;
  else if (!v && deal.owner_id) v = deal.owner_id;
  if (!v && deal.owner && typeof deal.owner === 'object' && deal.owner.id) v = deal.owner.id;
  else if (!v && deal.owner) v = deal.owner;
  v = Number(v);
  return v ? v : null;
}

function validateRowForActivityCreation_(rowValues) {
  var imovelCode = (rowValues[CONFIG.COL_IMOVEL - 1] || '').toString().trim();
  var dataAbertRaw = rowValues[CONFIG.COL_DATA_ABERT - 1];

  var recorrenciaImovel = (rowValues[CONFIG.COL_RECORRENCIA - 1] || '').toString().trim(); // J
  var descricao = (rowValues[CONFIG.COL_DESC - 1] || '').toString().trim();                // N
  var acaoEfetiva = (rowValues[CONFIG.COL_ACAO - 1] || '').toString().trim();              // R
  var setor = (rowValues[CONFIG.COL_SETOR - 1] || '').toString().trim();                   // Q
  var ownerSheet = (rowValues[CONFIG.COL_OWNER - 1] || '').toString().trim();              // R
  var executorRaw = (rowValues[CONFIG.COL_EXEC - 1] || '').toString().trim();              // S
  var origem = (rowValues[CONFIG.COL_ORIGEM - 1] || '').toString().trim();  // V
var lider = (rowValues[CONFIG.COL_LIDER - 1] || '').toString().trim();
if (!imovelCode) {
  return { ok: false, reason: 'A (código imóvel) vazio' };
}

if (!dataAbertRaw) {
  return { ok: false, reason: 'C (data abertura) vazia' };
}

var dataAbert = coerceToDate_(dataAbertRaw);

if (!dataAbert) {
  return { ok: false, reason: 'C (data abertura) inválida (não é data)' };
}

if (!isWithinOpeningWindow_(dataAbert)) {
  return {
    ok: false,
    reason: 'C (data abertura) fora da janela de ' + CONFIG.MAX_OPENING_AGE_DAYS + ' dia(s)'
  };
}

if (!descricao) {
  return { ok: false, reason: 'N (descrição da reclamação) vazio' };
}

if (!acaoEfetiva) {
  return { ok: false, reason: 'O (ação efetiva a ser executada para concluir a ouvidoria) vazio' };
}

if (!setor) {
  return { ok: false, reason: 'Q (etapa/setor) vazio' };
}

if (!ownerSheet) {
  return { ok: false, reason: 'R (proprietário/co-proprietário) vazio' };
}

if (!executorRaw && !isSetorFinanciamento_(setor)) {
  return { ok: false, reason: 'S (executor) vazio' };
}
if (!lider) {
  return { ok: false, reason: 'T (líder) vazio' };
}

if (!origem) {
  return { ok: false, reason: 'V (origem) vazio' };
}

  return {
    ok: true,
    imovelCode: imovelCode,
    dataAbertura: dataAbert,
    recorrenciaImovel: recorrenciaImovel,
    origem: origem,
    setor: setor,
    descricao: descricao,
    acaoEfetiva: acaoEfetiva,
    ownerSheet: ownerSheet,
    executorRaw: executorRaw,
    lider:lider
  };
}

function resolveActivityTypeKeyFromSetor_(setor) {
  var cfg = CONFIG.ACTIVITY_TYPE || {};
  if (cfg.KEY_OVERRIDE && String(cfg.KEY_OVERRIDE).trim()) return String(cfg.KEY_OVERRIDE).trim();
  if (cfg.NAME && String(cfg.NAME).trim() && typeof pdResolveActivityTypeKeyByName_ === 'function') {
    var byName = pdResolveActivityTypeKeyByName_(String(cfg.NAME).trim());
    if (byName) return byName;
  }
  if (cfg.ID_FALLBACK) {
    var byId = pdResolveActivityTypeKeyById_(cfg.ID_FALLBACK);
    if (byId) return byId;
  }
  return null;
}


// aplica a formula de recorrência na(s) coluna(s) configurada(s)





function resolveAssigneeUserIdsFromExecutorColumn_(executorRaw, ownerSheet, setor, dealOwnerId) {
  var executorText = String(executorRaw || '').trim();
  var ownerText = String(ownerSheet || '').trim();

  if (!executorText) {
    Logger.log('Executor vazio na coluna V. Não foi possível definir responsável da atividade.');
    return [];
  }

  // Se a coluna V começar com "Externo" ou "Parceiro", a atividade vai para Pedro Rocha.
  
  if (isExecutorExternoOuParceiroOuvidoria_(executorText)) {
    var pedroId = resolvePedroRochaUserId_();

    if (pedroId) {
      Logger.log(
        'Executor externo/parceiro detectado na coluna V. Atividade atribuída a Pedro Rocha. ' +
        'executorRaw="' + executorText + '", user_id=' + pedroId
      );

      return [Number(pedroId)];
    }

    Logger.log(
      'Executor externo/parceiro detectado, mas Pedro Rocha não foi resolvido. ' +
      'executorRaw="' + executorText + '", ownerSheet="' + ownerText + '"'
    );

    return [];
  }


  var normalized = normalizeExecutorText_(executorText);

  var candidates = normalized
    .split('|')
    .map(function(nome) {
      return String(nome || '').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  var userIds = [];

  for (var i = 0; i < candidates.length; i++) {
    var uid = resolveUserIdFromName_(candidates[i]);

    if (uid) {
      userIds.push(Number(uid));
    } else {
      Logger.log(
        'Executor não encontrado como usuário do Pipedrive: "' +
        candidates[i] +
        '". executorRaw="' +
        executorText +
        '"'
      );
    }
  }

  userIds = uniqueNumbers_(userIds);

  if (!userIds.length) {
    Logger.log(
      'Não foi possível resolver nenhum executor da coluna V. ' +
      'executorRaw="' + executorText + '", normalized="' + normalized + '", ownerSheet="' + ownerText + '"'
    );
  }

  return userIds;
}

function isExecutorExternoOuvidoria_(executorText) {
  var texto = String(executorText || '').trim();

  return /^externo\s*(?:[-–—:]|\b)/i.test(texto);
}

function isExecutorExternoOuParceiroOuvidoria_(executorText) {
  var texto = String(executorText || '').trim();
  return (
    /^externo\s*(?:[-–—:]|\b)/i.test(texto) ||
    /^parceiro\s*(?:[-–—:]|\b)/i.test(texto)
  );
}

function resolvePedroRochaUserId_() {
  if (typeof USUARIO_PEDRO_ROCHA_ID !== 'undefined' && Number(USUARIO_PEDRO_ROCHA_ID)) {
    return Number(USUARIO_PEDRO_ROCHA_ID);
  }

  var pedroName =
    typeof USUARIO_PEDRO_ROCHA !== 'undefined' && USUARIO_PEDRO_ROCHA
      ? USUARIO_PEDRO_ROCHA
      : 'Pedro Rocha';

  var pedroUserId = resolveUserIdFromName_(pedroName);

  if (pedroUserId) return Number(pedroUserId);

  // Fallback hardcoded (informado pelo time): Pedro Rocha (Pipedrive user_id).
  return 25418043;
}




function resolveAssigneeUserId_(executorRaw, ownerSheet, setor, dealOwnerId) {
  var executorText = String(executorRaw || '').trim();
  var ownerText = String(ownerSheet || '').trim();

  // REGRA:
  // A atividade deve ser criada para o executor da coluna V.
  //
  // EXCEÇÃO:
  // Se o executor da coluna V for Externo, no fluxo da ouvidoria isso representa
  // parceiro externo. Nesse caso, a atividade deve ser criada para Pedro Rocha.
  if (/^(Externo|Parceiro)\b/i.test(executorText)) {
    if (typeof USUARIO_PEDRO_ROCHA_ID !== 'undefined' && Number(USUARIO_PEDRO_ROCHA_ID)) {
      return Number(USUARIO_PEDRO_ROCHA_ID);
    }

    var pedroName =
      (typeof USUARIO_PEDRO_ROCHA !== 'undefined' && USUARIO_PEDRO_ROCHA)
        ? USUARIO_PEDRO_ROCHA
        : 'Pedro Rocha';

    var pedroUserId = resolveUserIdFromName_(pedroName);

    if (pedroUserId) {
      return Number(pedroUserId);
    }

    Logger.log(
      'Executor externo/parceiro detectado, mas Pedro Rocha não foi resolvido como usuário do Pipedrive. ' +
      'executorRaw="' + executorText + '", ownerSheet="' + ownerText + '"'
    );

    return 25418043;
  }

  // Caso normal:
  // cria a atividade para o próprio executor da coluna V.
  // Exemplo: "Interno - Ana Carolina" -> resolve "Ana Carolina".
  var normalized = normalizeExecutorText_(executorText);

  var candidates = normalized
    .split('|')
    .map(function(x) {
      return x.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  for (var i = 0; i < candidates.length; i++) {
    var uid = resolveUserIdFromName_(candidates[i]);

    if (uid) {
      return Number(uid);
    }
  }

  Logger.log(
    'Não foi possível resolver o executor como usuário do Pipedrive. ' +
    'executorRaw="' + executorText + '", normalized="' + normalized + '", ownerSheet="' + ownerText + '"'
  );

  return null;
}

 


function isSetorForceOwner_(setorNorm) {
  var list = CONFIG.SETORES_FORCE_OWNER_ASSIGNMENT || [];
  for (var i = 0; i < list.length; i++) {
    if (normalizeText_(list[i]) === setorNorm) return true;
  }
  return false;
}

function isExplicitInternal_(executorRaw) {
  return /^Interno\b/i.test(String(executorRaw || '').trim());
}

function shouldAssignToDealOwner_(executorRaw, ownerSheet) {
  var r = String(executorRaw || '').trim();
  if (!r) return true;
  if (/^Externo\b/i.test(r)) return true;
  if (/^(Prop|Propriet[aá]rio|Propriet[aá]ria|Proprietario|Proprietaria|Proponente|Arrematante)\b/i.test(r)) return true;
  var execNorm = normalizeText_(normalizeExecutorText_(r));
  var ownerNorm = normalizeText_(ownerSheet);
  if (ownerNorm && execNorm && (execNorm === ownerNorm || execNorm.indexOf(ownerNorm) !== -1)) return true;
  return false;
}

function normalizeExecutorText_(s) {
  var t = (s || '').toString().replace(/\s+/g, ' ').trim();
  t = t.replace(/\(Você\)/gi, '').trim();
  t = t.replace(/^(Interno|Externo)\s*-\s*/i, '').trim();
  t = t.replace(/^(Prop|Propriet[aá]rio|Propriet[aá]ria|Proprietario|Proprietaria|Proponente|Arrematante)\s*-\s*/i, '').trim();
  t = t.replace(/^(Prop|Propriet[aá]rio|Propriet[aá]ria|Proprietario|Proprietaria|Proponente|Arrematante)\s*:\s*/i, '').trim();
  return t;
}

function ensureLogColumn_(sheet) {
  var headerRow = 1;
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  var idx = headers.findIndex(function(h) { return (h || '').toString().trim() === CONFIG.LOG_HEADER; });
  if (idx !== -1) return idx + 1;
  sheet.getRange(headerRow, lastCol + 1).setValue(CONFIG.LOG_HEADER);
  return lastCol + 1;
}

function buildCacheKey_(sheetId, row, imovelCode, executorRaw, descricao, acaoEfetiva, setor, recorrenciaImovel) {
  var raw = (
    sheetId + '|' +
    row + '|' +
    imovelCode + '|' +
    executorRaw + '|' +
    descricao + '|' +
    acaoEfetiva + '|' +
    setor + '|' +
    (recorrenciaImovel || '')
  ).slice(0, 500);

  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);

  var hex = digest
    .map(function(b) {
      return (b + 256).toString(16).slice(-2);
    })
    .join('');

  return 'ouvidoria_activity:' + hex;
}

function wasRecentlyProcessed_(cacheKey) {
  return !!CacheService.getScriptCache().get(cacheKey);
}

function markProcessed_(cacheKey) {
  CacheService.getScriptCache().put(cacheKey, '1', 3600);
}

function coerceToDate_(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var s = String(value).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (m) {
    var dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    var d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d.getTime())) return d;
  }
  var dn = new Date(s);
  if (!isNaN(dn.getTime())) return dn;
  return null;
}

function isWithinOpeningWindow_(dateObj) {
  var maxDays = Number(CONFIG.MAX_OPENING_AGE_DAYS || 0);
  if (!maxDays) return true;
  var tz = Session.getScriptTimeZone();
  var openedStr = Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd');
  var todayStr  = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var opened = new Date(openedStr + 'T00:00:00');
  var today  = new Date(todayStr  + 'T00:00:00');
  var diffDays = Math.floor((today.getTime() - opened.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= maxDays;
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normalizeText_(s) {
  var x = String(s || '').trim().toLowerCase();
  try { return x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return x; }
}
function normalizeComparableText_(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[-_\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOrigemNps_(origem) {
  var normalizada = normalizeComparableText_(origem);
  return normalizada === 'nps' || normalizada === 'nps 1' || normalizada === 'nps 2';
}

function isSetorAtendimentoPosArrematacao_(setor) {
  var s = normalizeComparableText_(setor);

  return (
    s === 'atendimento pos arrematacao' ||
    s === 'atendimento pos' ||
    s.indexOf('atendimento pos arrematacao') !== -1
  );
}
function isCoPropOwnerSheet_(ownerSheet) {
  var s = String(ownerSheet || '').trim().toLowerCase();
  var p = String(CONFIG.COPROP_PREFIX || 'co-prop').toLowerCase();
  return s.indexOf(p) === 0;
}

function resolveCoPropContextKey_(ownerSheet, setor) {
  var a = normalizeText_(ownerSheet);
  var b = normalizeText_(setor);
  if (a.indexOf('iptu') !== -1 || b.indexOf('iptu') !== -1) return 'iptu';
  if (a.indexOf('condominio') !== -1 || b.indexOf('condominio') !== -1) return 'condominio';
  return null;
}

function resolveCoPropAssigneeUserIdsFromDeal_(deal, ownerSheet, setor) {
  if (!deal) return [];
  var ctx = resolveCoPropContextKey_(ownerSheet, setor);
  if (!ctx) return [];
  var map = CONFIG.COPROP_DEAL_FIELD_KEY_BY_SETOR_NORM || {};
  var fieldKey = map[ctx];
  if (!fieldKey) return [];

  var raw = deal[fieldKey];
  if (raw === undefined || raw === null || raw === '') return [];

  var values = [];
  if (Array.isArray(raw)) values = raw.slice();
  else if (typeof raw === 'string' && raw.indexOf(',') !== -1) {
    values = raw.split(',').map(function(x) { return String(x).trim(); }).filter(Boolean);
  } else values = [raw];

  var userIds = [];

  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (v === undefined || v === null || v === '') continue;

    var vStr = String(v).trim();
    var label = null;

    if (/^\d+$/.test(vStr)) label = getDealFieldOptionLabel_(fieldKey, vStr);
    if (!label) label = vStr;

    var names = String(label)
      .split('|')
      .map(function(x) { return String(x).replace(/\s+/g, ' ').trim(); })
      .filter(Boolean);

    for (var j = 0; j < names.length; j++) {
      var uid = resolveUserIdFromName_(names[j]);
      if (uid) userIds.push(Number(uid));
    }
  }

  return uniqueNumbers_(userIds);
}

function resolveUserIdFromName_(name) {
  var s = String(name || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;

  if (CONFIG.INTERNAL_USERS_BY_NAME && CONFIG.INTERNAL_USERS_BY_NAME[s]) return Number(CONFIG.INTERNAL_USERS_BY_NAME[s]);

  var norm = normalizeText_(s);
  var map = getInternalUsersByNameNorm_();
  if (map[norm]) return Number(map[norm]);

  var bestKey = null;
  var bestLen = -1;
  var ties = 0;

  for (var k in map) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    if (norm === k || norm.indexOf(k) !== -1 || k.indexOf(norm) !== -1) {
      if (k.length > bestLen) {
        bestKey = k;
        bestLen = k.length;
        ties = 1;
      } else if (k.length === bestLen) {
        ties++;
      }
    }
  }

  if (bestKey && ties === 1) return Number(map[bestKey]) || null;

  var byApi = pdFindUserIdByName_(s);
  return byApi ? Number(byApi) : null;
}

function getInternalUsersByNameNorm_() {
  if (getInternalUsersByNameNorm_._cache) return getInternalUsersByNameNorm_._cache;
  var src = CONFIG.INTERNAL_USERS_BY_NAME || {};
  var out = {};
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    out[normalizeText_(k)] = src[k];
  }
  getInternalUsersByNameNorm_._cache = out;
  return out;
}

function uniqueNumbers_(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < (arr || []).length; i++) {
    var n = Number(arr[i]);
    if (!n) continue;
    var k = String(n);
    if (seen[k]) continue;
    seen[k] = true;
    out.push(n);
  }
  return out;
}

function getDealFieldOptionLabel_(fieldKey, optionId) {
  var map = getDealFieldOptionsMapCached_();
  var opts = map && map[fieldKey] ? map[fieldKey] : null;
  if (!opts) return null;
  var v = opts[String(optionId)];
  return v ? String(v) : null;
}

function getDealFieldOptionsMapCached_() {
  var cache = CacheService.getScriptCache();
  var key = 'pd_deal_field_options_map_v1';
  var cached = cache.get(key);

  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }

  var needed = {};
  var bySetor = CONFIG.COPROP_DEAL_FIELD_KEY_BY_SETOR_NORM || {};
  for (var k in bySetor) {
    if (!Object.prototype.hasOwnProperty.call(bySetor, k)) continue;
    needed[String(bySetor[k])] = true;
  }

  var fields = pdGet_('/dealFields', {}) || [];
  var map = {};

  for (var i = 0; i < fields.length; i++) {
    var f = fields[i] || {};
    var fKey = f.key;
    if (!fKey || !needed[String(fKey)]) continue;

    var options = f.options || [];
    var optMap = {};
    for (var j = 0; j < options.length; j++) {
      var o = options[j] || {};
      var oid = o.id;
      var lbl = o.label || o.name || o.value;
      if (oid === undefined || oid === null) continue;
      if (lbl === undefined || lbl === null) continue;
      optMap[String(oid)] = String(lbl);
    }
    map[String(fKey)] = optMap;
  }

  try { cache.put(key, JSON.stringify(map), 21600); } catch (_) {}
  return map;
}








function testarCriacaoAtividadesLinha3() {
  var row = 5;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error('Aba "' + CONFIG.SHEET_NAME + '" não encontrada.');
  }

  if (sheet.getLastRow() < row) {
    throw new Error("A linha 3 não existe na aba " + CONFIG.SHEET_NAME + ".");
  }

  var logCol = ensureLogColumn_(sheet);

  var lastNeededCol = Math.max(
    CONFIG.COL_IMOVEL,
    CONFIG.COL_DATA_ABERT,
    CONFIG.COL_DESC,
    CONFIG.COL_ACAO,
    CONFIG.COL_SETOR,
    CONFIG.COL_OWNER,
    CONFIG.COL_RECORRENCIA,
    CONFIG.COL_EXEC,
    logCol
  );

  var rowValues = sheet.getRange(row, 1, 1, lastNeededCol).getValues()[0];

  var codigoImovel = String(rowValues[CONFIG.COL_IMOVEL - 1] || "").trim();
  var dataAbertura = rowValues[CONFIG.COL_DATA_ABERT - 1];
  var descricao = String(rowValues[CONFIG.COL_DESC - 1] || "").trim();
  var setor = String(rowValues[CONFIG.COL_SETOR - 1] || "").trim();
  var proprietario = String(rowValues[CONFIG.COL_OWNER - 1] || "").trim();
  var executor = String(rowValues[CONFIG.COL_EXEC - 1] || "").trim();

  Logger.log("═══════════════════════════════════════");
  Logger.log("TESTE DE CRIAÇÃO DE ATIVIDADE - LINHA 3");
  Logger.log("═══════════════════════════════════════");
  Logger.log('Código do imóvel: "' + codigoImovel + '"');
  Logger.log('Data de abertura: "' + dataAbertura + '"');
  Logger.log('Descrição: "' + descricao + '"');
  Logger.log('Setor: "' + setor + '"');
  Logger.log('Proprietário da atividade: "' + proprietario + '"');
  Logger.log('Executor da coluna V: "' + executor + '"');

  if (!codigoImovel) {
    var msgCodigo = "Não testou: código do imóvel vazio na linha 3.";
    Logger.log(msgCodigo);
    sheet.getRange(row, logCol).setValue(msgCodigo);
    return;
  }

  var validation = validateRowForActivityCreation_(rowValues);

  if (!validation.ok) {
    var msgValidacao = "Não testou: " + validation.reason;
    Logger.log(msgValidacao);
    sheet.getRange(row, logCol).setValue(msgValidacao);
    return;
  }

  if (/^Externo\s*(?:[-–—:]|\b)/i.test(validation.executorRaw)) {
      Logger.log(
      'Executor externo detectado na coluna V: "' +
      validation.executorRaw +
      '". A atividade deve ser criada para Pedro Rocha.'
    );
  } else {
    Logger.log(
      'Executor interno/normal detectado na coluna V: "' +
      validation.executorRaw +
      '". A atividade será criada para esse executor.'
    );
  }

  Logger.log("Chamando processRowCreateActivities_ somente para a linha 3...");

  processRowCreateActivities_(sheet, row);

  var logFinal = sheet.getRange(row, logCol).getDisplayValue();

  Logger.log("Resultado final gravado no log da linha 3:");
  Logger.log(logFinal);
  Logger.log("═══════════════════════════════════════");
  Logger.log("FIM DO TESTE - LINHA 3");
  Logger.log("═══════════════════════════════════════");
}
