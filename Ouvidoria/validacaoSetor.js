// ╔══════════════════════════════════════════════════════════════╗
// ║   VALIDAÇÃO DO EXECUTOR – COLUNA T (20)  ·  v2              ║
// ║   Busca negócio no Pipedrive pelo código do imóvel (col A)   ║
// ╚══════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════════════════════════
//  SEÇÃO 1 – CONSTANTES DE COLUNAS
// ══════════════════════════════════════════════════════════════
const PIPEDRIVE_TOKEN  = PropertiesService.getScriptProperties().getProperty("PIPEDRIVE_TOKEN");
const PIPEDRIVE_DOMAIN = PropertiesService.getScriptProperties().getProperty("PIPEDRIVE_DOMAIN");
const USUARIO_PEDRO_ROCHA = "Pedro Rocha";
const USUARIO_PEDRO_ROCHA_ID = 25418043;
const TIPO_INTERNO = "Interno";
const TIPO_EXTERNO = "Externo";
const NOME_ABA_EQUIPE = "Equipe";
const COL_EQUIPE_FUNCIONARIO = 2; // B – nome do funcionário
const COL_EQUIPE_LIDER = 5;      // E – líder

function _resolveHeaderCol_(sheet, header, fallbackCol) {
  try {
    if (!sheet) return fallbackCol;
    var lastCol = sheet.getLastColumn();
    if (!lastCol) return fallbackCol;
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
    var wanted = _normalizarTexto(header);
    for (var c = 0; c < headers.length; c++) {
      if (_normalizarTexto(headers[c]) === wanted) return c + 1;
    }
  } catch (_) {}
  return fallbackCol;
}

function _getOuvidoriaCols_(sheet) {
  return {
    IMOVEL: _resolveHeaderCol_(sheet, 'Código do Imóvel', CONFIG.COL_IMOVEL),
    SETOR: _resolveHeaderCol_(sheet, 'Setor', CONFIG.COL_SETOR),
    PROPONENTE: _resolveHeaderCol_(sheet, 'Proponente Principal', CONFIG.COL_PROPONENTE),
    OWNER: _resolveHeaderCol_(sheet, 'Proprietário/Co-proprietário', CONFIG.COL_OWNER),
    EXECUTOR: _resolveHeaderCol_(sheet, 'Executor', CONFIG.COL_EXEC),
    LIDER: _resolveHeaderCol_(sheet, 'Líder', CONFIG.COL_LIDER),
    ORIGEM: _resolveHeaderCol_(sheet, 'Origem', CONFIG.COL_ORIGEM)
  };
}

function _colImovel_(sheet) { return _getOuvidoriaCols_(sheet).IMOVEL; }
function _colSetor_(sheet) { return _getOuvidoriaCols_(sheet).SETOR; }
function _colProponente_(sheet) { return _getOuvidoriaCols_(sheet).PROPONENTE; }
function _colOwner_(sheet) { return _getOuvidoriaCols_(sheet).OWNER; }
function _colExecutor_(sheet) { return _getOuvidoriaCols_(sheet).EXECUTOR; }
function _colLider_(sheet) { return _getOuvidoriaCols_(sheet).LIDER; }

// Fallbacks para o restante do arquivo (mantém compatibilidade com o mapeamento antigo)
const COL_CODIGO_IMOVEL = CONFIG.COL_IMOVEL;
const COL_SETOR = CONFIG.COL_SETOR;
const COL_PROPONENTE = CONFIG.COL_PROPONENTE;
const COL_PROPRIETARIO_ATIVIDADE = CONFIG.COL_OWNER;
const COL_EXECUTOR = CONFIG.COL_EXEC;
const COL_LIDER_RESPONSAVEL = CONFIG.COL_LIDER;
// ══════════════════════════════════════════════════════════════
//  SEÇÃO 2 – GRUPOS DE SETORES
//  Todos os valores já estão normalizados (sem acento, minúsculo)
//  para comparação direta com _normalizarTexto()
// ══════════════════════════════════════════════════════════════

// Grupo Proprietário: executor e responsável = proprietário do imóvel (sempre)
const SETORES_GRUPO_PROPRIETARIO = [
  "pre arrematacao",
  "triagem",
  "subsidio",
  "atendimento pos arrematacao",
  "leilao negativo",
    "fgts a vista",
  "cancelamento", 
];
const CAMPO_ATRIBUIDO_ANALISE_BASICA = {
  nome: "Atribuído: Análise Básica",
  key : "73d5e4a4acdddf6759fc7d6a2f310116d9c838f3",
  id  : 231,
  options: {
    377: "Maria Prata",
    378: "Graziele Rosa",
    767: "Lívia Duarte",
    383: "Gabriel Romano",
    399: "N/A",
    996: "Isabella Lages",
    1371: "Rayssa Regis",
    1440: "Raissa Lopes",
    1825: "Davi Parma",
    1886: "Igor Rafael",
    1892: "Ana Duarte",
    1893: "Daniel Moreira",
    1895: "Israel Carmo",
    1988: "Blenda Fonseca",
    2065: "Davi Vieira",
    2067: "Tatiane Gomes",
    2132: "Luisa Machado",
    2150: "Amanda Pereira",
    2151: "Lucas Marx",
    2536: "Vinicius Cavalcanti",
    2538: "Gabriel Max"
  }
};

const CAMPO_ATRIBUIDO_ANALISE_JURIDICA = {
  nome: "Atribuído: Análise Jurídica",
  key : "ab4066f405319986f4179c21733a41887c68ad52",
  id  : 233,
  options: {
    665: "n/a",
    713: "Kauã Amorim",
    764: "Lívia Duarte",
    1068: "Rayssa Regis",
    1512: "Bruna Pimentel",
    1519: "Gabriel Romano",
    1636: "Blenda Fonseca",
    2068: "Evelyn Silva",
    2463: "Maria Prata",
    2464: "Luisa Machado",
    2465: "Raissa Lopes"
  }
};

const CAMPO_ATRIBUIDO_ANALISE_MERCADO = {
  nome: "Atribuído: Análise de Mercado",
  key : "01776e9fd027b30f1302a306367edaa4b1472eac",
  id  : 232,
  options: {
    384: "Maria Prata",
    385: "Graziele Rosa",
    390: "Gabriel Romano",
    400: "N/A",
    1441: "Raissa Lopes",
    1639: "Isabella Lages",
    1888: "Igor Rafael",
    2061: "Tatiane Gomes",
    2153: "Amanda Pereira",
    2154: "Lucas Marx"
  }
};

const CAMPO_ATRIBUIDO_LEVANTAMENTO_COND_PRE = {
  nome: "Atribuído: Levantamento de Condomínio - Pré Arrematação",
  key : "61eb918bf87b908f71693036828689939da86da7",
  id  : 497,
  options: {
    2439: "Glória de Oliveira",
    2440: "Isabella Lages",
    2441: "Raissa Lopes",
    2442: "Maria Prata",
    2443: "Luisa Machado",
    2445: "Blenda Fonseca",
    2447: "Ana Duarte",
    2444: "n/a"
  }
};
// Grupo 2 (original): condomínio | desocupação | IPTU
// Usam campo "Atribuído" específico por setor
const SETORES_GRUPO2 = [
  "condominio",
  "desocupacao",
  "iptu"
];


// ══════════════════════════════════════════════════════════════
//  SEÇÃO 3 – CAMPOS DO PIPEDRIVE
// ══════════════════════════════════════════════════════════════

const CAMPO_PARCEIRO = {
  nome: "Parceiro Responsável",
  key : "97e72d089584c2ea6c63d48cf8574db7c2cd5fe6",
  options: {
    605:"n/a",807:"Documentall",1891:"POC [Documentall]",706:"AL - André",
    1537:"RN - Dominique",1595:"MG - Rafael",1644:"RS - Claudia",592:"MG - Camily",
    1262:"SP - Fernando",593:"SP - Istamir",1927:"SP - Oliveira",595:"PR - Graziela",
    599:"MA - Morgana",639:"PB - Pedro",841:"GO - Vanessa",1108:"RJ - Leticia",
    1261:"MG - Mariana",1509:"RJ - Stefani",1974:"RS - Silvio",1538:"CE - Manuela",
    1539:"PE - Roberta",1596:"PB - Nicoli",1579:"PB - Larissa",1660:"PB - Melissa",
    1970:"GO - Murta",1588:"GO - Warlyson",1662:"MT - Ozeny",2090:"PA - Debora",
    1587:"PB - Francisco [Desativado]",1374:"MG - Anizio [Desativado]",
    1835:"GO - Enderson [Desativado]",1590:"PE - Maria [Desativado]",
    1963:"RO - Michele [Desativado]",1658:"SE - Fabio [Desativado]",
    1756:"SC - Tiago [Desativado]",1535:"RS - Leonardo [Desativado]",
    1578:"BA - Mavia [Desativado]",2091:"RJ - Jessica [Desativado]",
    2092:"PI - Araujo [Desativado]",1536:"RJ - Almeida [Desativado]",
    1661:"CE - Nathielly [Desativado]",1863:"TO - Crislainne (Desativado)",
    1645:"BA - Jackeline (Desativado)",1663:"MT - Juliana (Desativado)",
    594:"Marilene (Desativado)",597:"Adrianne (Desativado)",694:"Alison (Desativado)",
    840:"Vanessa (Desativado)",596:"Darlan (Desativado)",598:"Naiana (Desativado)",
    695:"Laurizane (Desativado)",591:"Rafaela (Desativado)",600:"Thaisline (Desativado)",
    674:"Luana (Desativado)",948:"Thiago (Desativado)",1510:"Magda (Desativado)",
    1589:"Amorim (Desativado)",1511:"Katia (Desativado)",1643:"MS - Vinicius (Desativado)",
    1754:"PR - Fernanda (Desativado)",1594:"SP - Jose (Desativado)",
    1874:"PI - Maryanna (Desativado)",1659:"BA- Joao (Desativado)",
    839:"RS - Silvia (Desativado)",1872:"RN - Moura (Desativado)",
    1897:"PA - Ghessica (Desativado)"
  }
};

const CAMPO_PROPRIETARIO = {
  nome: "Proprietário",
  key : "user_id"  // campo nativo do Pipedrive
};
const CAMPO_NOME_ARREMATANTE = {
  nome: "Nome do Arrematante",
  key: "dfe3b8f6919638e6d107758dbee74ed1be341803",
  id: 414
};

// NOVO: campo que determina o tipo de executor no contrato
const CAMPO_EXECUTOR_CONTRATO = {
  nome: "Executor: Contrato",
  key : "1dbb1d3c497001898a92edd0a1799d19485bf26e",
  options: {
    412: "Terceiro",
    1494: "Terceiro Substituto",
    359: "Smart",
    683: "Gerente externo (FGTS)",
    500: "Cartório/CCA Externo",
    2438: "CCA Smart Caixa",
    358: "Cartório/CCA Parceiro (não utilizar)"
  }
};
const CAMPO_EXECUTOR_ITBI = {
  nome: "Executor: ITBI",
  key: "90cec4ad4796cbca9a16f4d3626b643cc0e090d9",
  id: 208,
  options: [
    { id: 498, label: "Terceiro" },
    { id: 1495, label: "Terceiro Substituto" },
    { id: 318, label: "Smart" },
    { id: 317, label: "Cliente (com acompanhamento)" },
    { id: 1492, label: "Cliente (sem acompanhamento)" },
    { id: 319, label: "Cartório Externo" },
    { id: 497, label: "Cartório Parceiro (não utilizar)" }
  ]
};

const CAMPO_EXECUTOR_TITULARIDADE = {
  nome: "Executor: Titularidade",
  key: "03d5b34bd64eb313c521deed73537201ff73951b",
  id: 339,
  options: [
    { id: 1032, label: "Terceiro" },
    { id: 1496, label: "Terceiro Substituto" },
    { id: 1367, label: "Smart" },
    { id: 1033, label: "Cliente (com acompanhamento)" },
    { id: 1491, label: "Cliente (sem acompanhamento)" },
    { id: 1034, label: "Cartório Externo" }
  ]
};

const CAMPO_EXECUTOR_REGISTRO = {
  nome: "Executor: Registro",
  key: "ae3bc94d6a98d3509c6803d2b3b6351927a2f5e2",
  options: [
    { id: 805, label: "Terceiro" },
    { id: 168, label: "Smart" },
    { id: 170, label: "Cliente com acompanhamento" },
    { id: 1493, label: "Cliente sem acompanhamento" },
    { id: 169, label: "Cartório Externo" },
    { id: 499, label: "Cartório Parceiro (não utilizar)" },
    { id: 1497, label: "Terceiro Substituto" }
  ]
};

const CAMPO_ATRIBUIDO_IPTU = {
  nome: "Atribuído: IPTU",
  key : "0fcbf77e257f7fd8665f159af46fdb56885b91f4",
  options: {
    876:"n/a",867:"Ana Carolina",1522:"Ana Duarte",1021:"Ana Oliveira",
    557:"Bianca Neubaner",1793:"Caroline",558:"Daniel",1430:"Gabriel Amaro",
    794:"Gabriella Campos",460:"Geovana Rita",559:"Hana",561:"Higor",
    923:"Isabelle França",1029:"Jessica",678:"João Moraes",1795:"Julia Faria",
    699:"Julia Luize",461:"Kiara",858:"Letícia",462:"Lucas Miranda",
    1431:"Lucas Tolentino",463:"Luiza Cavalcanti",845:"Maria Gomes",656:"Pierre",
    560:"Rafaela",464:"Raíssa",1125:"Stephane Martins",466:"Thiago",601:"Vitor",
    1548:"Nathalia Rezende",1633:"Emily Sousa",1749:"Triagem",1957:"Hevilly Silva",
    2134:"Jean Valle",2217:"Alessandra Oliveira",2489:"Júlia Bastos"
  }
};

const CAMPO_ATRIBUIDO_COND = {
  nome: "Atribuído: Condomínio",
  key : "4dc70e8904db7e180a7b8faa20c074f6f4351dd8",
  options: {
    878:"n/a",1807:"Amanda Santos",868:"Ana Carolina",1022:"Ana Oliveira",
    556:"Bianca Neubaner",1646:"Clarissa Bomfim",440:"Daniel",1582:"Daniel Moreira",
    1126:"Darya",1169:"Davi Parma",795:"Gabriella Campos",1127:"Geovani",
    504:"Hana Leticia",1506:"Hellen Agnes",562:"Higor",1792:"Igor Rafael",
    924:"Isabella",1027:"Jessica",679:"João Moraes",700:"Julia Luize",
    859:"Letícia",1429:"Luara",1586:"Luisa Bernardino",1805:"Luiza Braz",
    554:"Luiza Cavalcanti",846:"Maria Gomes",1432:"Nathalia",657:"Pierre",
    442:"Rafaela",1128:"Rayssa Caetano",563:"Thiago",1270:"Valdileia",
    503:"Vitor",1438:"Stephane Martins",1505:"Helena Pereira",1507:"Mariana Vargas",
    1549:"Nathalia Rezende",1627:"Teste (temporário)",1634:"Emily Sousa",
    1750:"Triagem",1876:"Israel Carmo",1956:"Hevilly Silva",2053:"Ana SIlva",
    2215:"Isadora",2216:"Glória Silva",2401:"Hugo Silva",2402:"Victor Fernandes",
    2431:"Vander Cardoso"
  }
};

const CAMPO_ATRIBUIDO_DESOC = {
  nome: "Atribuído: Desocupação",
  key : "17f8d4212ef649fa586d70f9ab434efbf5804456",
  options: {
    784:"Bruna Pimentel",944:"Jose Magalhaes",478:"Pierre",783:"Maria Eduarda",
    477:"Viviane",1028:"Jessica",1439:"Stephane Martins",1508:"Evelyn Silva",
    1550:"Nathalia Rezende",1635:"Emily Sousa",881:"n/a",1751:"Triagem",
    1958:"Hevilly Silva",2157:"Larissa Coelho"
  }
};


// ══════════════════════════════════════════════════════════════
//  SEÇÃO 4 – GATILHO (onEdit)
// ══════════════════════════════════════════════════════════════

function validarExecutorColunaQ(e) {
  const range = e.range;
  const cols = _getOuvidoriaCols_(range.getSheet());
  if (range.getColumn() !== cols.SETOR) return;

  const sheet = range.getSheet();
  const row   = range.getRow();
  if (row <= 1) return;

  _processarLinha(sheet, row);
}

function aoEditarOuvidoria(e) {
  try {
    if (!e || !e.range) return;

    const range = e.range;
    const sheet = range.getSheet();
    const cols = _getOuvidoriaCols_(sheet);

    if (sheet.getName() !== "Ouvidoria") return;
    if (range.getRow() <= 1) return;

    const colunaEditada = range.getColumn();
    const linhaEditada = range.getRow();

    // Quando editar o setor na coluna T
    if (colunaEditada === cols.SETOR) {
      try {
        _processarLinha(sheet, linhaEditada);
      } catch (erro) {
        logErroOuvidoria_("Erro em _processarLinha, linha " + linhaEditada, erro);
      }

      return;
    }

    // Quando editar o executor manualmente na coluna V
    if (colunaEditada === cols.EXECUTOR) {
      try {
        preencherLiderResponsavelLinha(linhaEditada);
      } catch (erro) {
        logErroOuvidoria_("Erro em preencherLiderResponsavelLinha, linha " + linhaEditada, erro);
      }

      return;
    }

  } catch (erro) {
    logErroOuvidoria_("Erro geral em aoEditarOuvidoria", erro);
  }
}
function logErroOuvidoria_(local, erro) {
  const mensagem = erro && erro.message ? erro.message : erro;

  Logger.log("OUVIDORIA | " + local + " | " + mensagem);

  if (erro && erro.stack) {
    Logger.log(erro.stack);
  }

  throw erro;
}
// ══════════════════════════════════════════════════════════════
//  SEÇÃO 5 – ORQUESTRAÇÃO
// ══════════════════════════════════════════════════════════════
function _resolverExecutorPorCampo_(deal, campo) {
  if (!deal || !campo || !campo.key) return "";

  const valor = deal[campo.key];

  return _obterLabelOpcaoCampo_(campo, valor);
}




function _getSheetOuvidoria() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Ouvidoria");

  if (!sheet) {
    throw new Error('Aba "Ouvidoria" não encontrada.');
  }


  return sheet;
}
function diagnosticarColunasValidacaoLinha2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const row = 2;

  Logger.log('COL_SETOR=' + CONFIG.COL_SETOR + ' valor="' + sheet.getRange(row, CONFIG.COL_SETOR).getDisplayValue() + '"');
  Logger.log('COL_OWNER=' + CONFIG.COL_OWNER + ' valor="' + sheet.getRange(row, CONFIG.COL_OWNER).getDisplayValue() + '"');
  Logger.log('COL_EXEC=' + CONFIG.COL_EXEC + ' valor="' + sheet.getRange(row, CONFIG.COL_EXEC).getDisplayValue() + '"');
  Logger.log('COL_LIDER=' + CONFIG.COL_LIDER + ' valor="' + sheet.getRange(row, CONFIG.COL_LIDER).getDisplayValue() + '"');
  Logger.log('COL_ORIGEM=' + CONFIG.COL_ORIGEM + ' valor="' + sheet.getRange(row, CONFIG.COL_ORIGEM).getDisplayValue() + '"');
}

function testarPreenchimentoOuvidoriaLinha(row) {
  var linha = Number(row || 2);
  if (!linha || linha < 2) throw new Error('Informe uma linha >= 2. Ex: testarPreenchimentoOuvidoriaLinha(3)');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ouvidoria');
  if (!sheet) throw new Error('Aba "Ouvidoria" não encontrada.');

  Logger.log('TESTE OUVIDORIA | iniciando linha ' + linha);
  _processarLinha(sheet, linha);
  SpreadsheetApp.flush();

  Logger.log('TESTE OUVIDORIA | após processar:');
  Logger.log('A (imóvel): "' + sheet.getRange(linha, COL_CODIGO_IMOVEL).getDisplayValue() + '"');
  Logger.log('B (proponente): "' + sheet.getRange(linha, COL_PROPONENTE).getDisplayValue() + '"');
  Logger.log('C (telefone): "' + sheet.getRange(linha, COL_TELEFONE_ARREMATANTE).getDisplayValue() + '"');
  Logger.log('Q (setor): "' + sheet.getRange(linha, COL_SETOR).getDisplayValue() + '"');
  Logger.log('S (executor): "' + sheet.getRange(linha, COL_EXECUTOR).getDisplayValue() + '"');
  Logger.log('T (líder): "' + sheet.getRange(linha, COL_LIDER).getDisplayValue() + '"');

  return { ok: true, row: linha };
}
function _processarLinha(sheet, row) {
  const cols = _getOuvidoriaCols_(sheet);
  const contexto = _obterContextoLinha(sheet, row, cols);
  if (!contexto) return;

  if (isCodigoImovelManual_ && isCodigoImovelManual_(contexto.codigoImovel)) {
    _appendOuvidoriaLogAtividades_(
      sheet,
      row,
      'Código do imóvel = "N/A": preenchimento manual; sistema não consulta/atualiza Pipedrive/Drive nesta linha.'
    );
    Logger.log(`Linha ${row}: código do imóvel "N/A" detectado. Ignorando integração com Pipedrive/Drive.`);
    return;
  }

  const deal = _buscarDealPorCodigoImovel(contexto.codigoImovel);
  if (!deal) {
    Logger.log(`Linha ${row}: negócio não encontrado para o código "${contexto.codigoImovel}".`);
    return;
  }

  const proponente = _resolverNomeArrematante(deal);
  _gravarProponente(sheet, row, proponente, cols);
  _gravarTelefoneArrematante_(sheet, row, deal);

  const resultado = _definirExecutorEAtividade(deal, contexto.setor);
  if (!resultado) {
    Logger.log(`Linha ${row}: setor "${contexto.setor}" não mapeado em nenhuma regra. Líder não preenchido.`);
    return;
  }

  _gravarResultado(sheet, row, resultado);

  // Garante que o executor gravado na coluna V esteja disponível
  SpreadsheetApp.flush();

  const setorNorm = _normalizarTexto(contexto.setor);

if (setorNorm === "financiamento") {
  Logger.log(
    `Linha ${row}: setor Financiamento tratado sem executor. Líder fixo já processado.`
  );
  return;
}

const executorGravado = _lerCelula(sheet, row, cols.EXECUTOR).trim();

Logger.log(`Linha ${row}: executor gravado antes de buscar líder: "${executorGravado}"`);

if (!executorGravado) {
  Logger.log(`Linha ${row}: líder não preenchido porque o executor ficou vazio após _gravarResultado.`);
  return;
}

// O líder já é preenchido dentro de _gravarResultado()
// pela função preencherLiderDaLinha_(sheet, row, valorSAjustado).
Logger.log(`Linha ${row}: líder já tratado em _gravarResultado.`);

  Logger.log(
    `✔ Linha ${row} | Setor: "${contexto.setor}" | Imóvel: "${contexto.codigoImovel}" ` +
    `| Proponente: "${proponente}" | Executor: "${resultado.executor}" | Responsável: "${resultado.responsavelAtividade}"`
  );
}
function _gravarProponente(sheet, row, nome, cols) {
  if (!nome) return;
  var nomeUpper = String(nome || '').toUpperCase().trim();
  if (!nomeUpper) return;
  Logger.log("NOME QUE SERÁ GRAVADO NA PLANILHA: " + nomeUpper);

  cols = cols || _getOuvidoriaCols_(sheet);
  const cell = sheet.getRange(row, cols.PROPONENTE);
  cell.setValue(nomeUpper);
}

const COL_TELEFONE_ARREMATANTE = 3;
const CAMPO_TELEFONE_ARREMATANTE = {
  id: 415,
  nome: 'Telefone do Arrematante',
  key: '534ddc592e7b7db4b6d6faff0d07f2071684039e'
};

function _gravarTelefoneArrematante_(sheet, row, deal) {
  try {
    if (!sheet || !deal) return;

    const cell = sheet.getRange(row, COL_TELEFONE_ARREMATANTE);
    const atual = String(cell.getDisplayValue() || '').trim();
    if (atual) return;

    const raw = deal[CAMPO_TELEFONE_ARREMATANTE.key];
    const telefone = raw == null ? '' : String(raw).trim();
    if (!telefone) return;

    cell.setValue(telefone);
  } catch (e) {
    Logger.log('Aviso: falha ao gravar telefone do arrematante na linha ' + row + ': ' + (e && e.message ? e.message : e));
  }
}

// ══════════════════════════════════════════════════════════════
//  SEÇÃO 6 – LEITURA DA PLANILHA
// ══════════════════════════════════════════════════════════════

function _obterContextoLinha(sheet, row, cols) {
  cols = cols || _getOuvidoriaCols_(sheet);
  const setor        = _lerCelula(sheet, row, cols.SETOR).trim();
  const codigoImovel = _lerCelula(sheet, row, cols.IMOVEL).trim();
Logger.log(
  `DEBUG setor | linha=${row} | COL_SETOR=${cols.SETOR} | valor="${_lerCelula(sheet, row, cols.SETOR)}"`
);

  if (!setor) {
   Logger.log(
  `Linha ${row}: setor vazio na coluna configurada COL_SETOR=${cols.SETOR}.`
);
    return null;
  }
  if (!codigoImovel) {
    Logger.log(`Linha ${row}: código do imóvel vazio na coluna A.`);
    return null;
  }

  return { setor, codigoImovel };
}

function _appendOuvidoriaLogAtividades_(sheet, row, mensagem) {
  try {
    if (!sheet || !row) return;
    if (typeof ensureLogColumn_ !== 'function') return;
    var logCol = ensureLogColumn_(sheet);
    var cell = sheet.getRange(row, logCol);
    var texto = String(mensagem || '').trim();
    if (!texto) return;
    cell.setValue(texto);
  } catch (e) {
    Logger.log('Aviso: falha ao gravar Log atividades na linha ' + row + ': ' + (e && e.message ? e.message : e));
  }
}


// ══════════════════════════════════════════════════════════════
//  SEÇÃO 7 – BUSCA NO PIPEDRIVE
// ══════════════════════════════════════════════════════════════

function _buscarDealPorCodigoImovel(codigo) {
  try {
    if (isCodigoImovelManual_ && isCodigoImovelManual_(codigo)) return null;
    const urlBusca =
      `https://${PIPEDRIVE_DOMAIN}/api/v1/deals/search` +
      `?term=${encodeURIComponent(codigo)}` +
      `&api_token=${PIPEDRIVE_TOKEN}`;

    Logger.log("URL BUSCA: " + urlBusca);
    const resBusca = UrlFetchApp.fetch(urlBusca, { muteHttpExceptions: true });
    Logger.log("HTTP SEARCH: " + resBusca.getResponseCode());

    if (resBusca.getResponseCode() !== 200) {
      Logger.log(`Pipedrive /search HTTP ${resBusca.getResponseCode()} para "${codigo}".`);
      return null;
    }

    const jsonBusca = JSON.parse(resBusca.getContentText());
    const items = jsonBusca.data && jsonBusca.data.items;

    if (!items || items.length === 0) {
      Logger.log(`Pipedrive: nenhum negócio encontrado para "${codigo}".`);
      return null;
    }

    const dealId = items[0].item.id;
    Logger.log("DEAL ID SELECIONADO: " + dealId);

    const urlDeal =
      `https://${PIPEDRIVE_DOMAIN}/api/v1/deals/${dealId}` +
      `?api_token=${PIPEDRIVE_TOKEN}`;

    const resDeal = UrlFetchApp.fetch(urlDeal, { muteHttpExceptions: true });
    Logger.log("HTTP DEAL: " + resDeal.getResponseCode());

    if (resDeal.getResponseCode() !== 200) {
      Logger.log(`Pipedrive /deals/${dealId} HTTP ${resDeal.getResponseCode()}.`);
      return null;
    }

    const jsonDeal = JSON.parse(resDeal.getContentText());
    return jsonDeal.success ? jsonDeal.data : null;

  } catch (err) {
    Logger.log(`Erro na integração Pipedrive (código "${codigo}"): ${err}`);
    return null;
  }
}
function _resolverNomeArrematante(deal) {
  const valor = deal[CAMPO_NOME_ARREMATANTE.key];
  Logger.log("NOME ARREMATANTE RAW DO PIPEDRIVE: " + JSON.stringify(valor));

  if (valor === null || valor === undefined || valor === "") return "";

  if (typeof valor === "object") {
    if (valor.value) return String(valor.value);
    if (valor.label) return String(valor.label);
    if (valor.name) return String(valor.name);
  }

  return String(valor);
}

// ══════════════════════════════════════════════════════════════
//  SEÇÃO 8 – REGRAS DE NEGÓCIO
//
//  Hierarquia de decisão:
//
//  1. Grupo Proprietário (setores que SEMPRE delegam ao proprietário)
//  2. Setores que consultam "Executor: Contrato" antes de decidir:
//     ├─ Financiamento
//     ├─ CCV
//     ├─ Escritura
//     ├─ FGTS à vista
//     ├─ Registro
//     ├─ Titularidade
//     └─ ITBI
//  3. Contrato (lógica original: parceiro → Pedro Rocha, ou proprietário)
//  4. Grupo 2 (condomínio | desocupação | IPTU → campo "Atribuído")
// ══════════════════════════════════════════════════════════════
function _obterExecutorRegistro(deal) {
  const valorExecutorRegistro = deal[CAMPO_EXECUTOR_REGISTRO.key];

  return _obterLabelOpcaoCampo_(
    CAMPO_EXECUTOR_REGISTRO,
    valorExecutorRegistro
  );
}
function _definirExecutorEAtividade(deal, setor) {
  const sn = _normalizarTexto(setor);
  const proprietario = _resolverProprietario(deal);

  // Financiamento: mantém o proprietário do imóvel na coluna U, deixa o
  // executor manual e define Kauã Amorim como líder em _gravarResultado.
  if (isSetorFinanciamento_(setor)) {
    Logger.log(`Setor "${sn}" → proprietário do imóvel em U, executor manual e líder Kauã Amorim.`);
    return _retornoProprietario(proprietario);
  }

  const resultadoNovosSetores = _retornoAtribuidoOuProprietario(deal, sn, proprietario);

  if (resultadoNovosSetores) {
    return resultadoNovosSetores;
  }

  const execRegistroRaw = _resolverExecutorPorCampo_(deal, CAMPO_EXECUTOR_REGISTRO);
  const execRegistroNorm = _normalizarTexto(execRegistroRaw);

  const execTitularidadeRaw = _resolverExecutorPorCampo_(deal, CAMPO_EXECUTOR_TITULARIDADE);
  const execTitularidadeNorm = _normalizarTexto(execTitularidadeRaw);

  const execItbiRaw = _resolverExecutorPorCampo_(deal, CAMPO_EXECUTOR_ITBI);
  const execItbiNorm = _normalizarTexto(execItbiRaw);

  // ── 1. Setores que sempre delegam ao proprietário ─────────────────────
  if (SETORES_GRUPO_PROPRIETARIO.includes(sn)) {
    Logger.log(`Grupo Proprietário: setor "${sn}" → proprietário.`);
    return _retornoProprietario(proprietario);
  }

  // ── 2. Setores que dependem do campo "Executor: Contrato" ─────────────
  const execContrato = _resolverOpcao(deal, CAMPO_EXECUTOR_CONTRATO);
  const execContratoNorm = _normalizarTexto(execContrato);

  Logger.log(`Setor: "${sn}" | Executor Contrato raw: "${execContrato}" | norm: "${execContratoNorm}"`);

  // daqui para baixo mantenha as demais regras: CCV, escritura, registro, titularidade, ITBI etc.
function _resolverCampoAtribuidoNovosSetores(setorNorm) {
  if (setorNorm === "analise basica") {
    return CAMPO_ATRIBUIDO_ANALISE_BASICA;
  }

  if (setorNorm === "analise juridica") {
    return CAMPO_ATRIBUIDO_ANALISE_JURIDICA;
  }

  if (setorNorm === "analise de mercado") {
    return CAMPO_ATRIBUIDO_ANALISE_MERCADO;
  }

  if (
    setorNorm === "levantamento de condominio" ||
    setorNorm === "condominio pre"
  ) {
    return CAMPO_ATRIBUIDO_LEVANTAMENTO_COND_PRE;
  }

  return null;
}

function _retornoAtribuidoOuProprietario(deal, setorNorm, proprietario) {
  const campo = _resolverCampoAtribuidoNovosSetores(setorNorm);

  if (!campo) return null;

  const atribuido = _resolverOpcao(deal, campo) || "";
  const atribuidoNorm = _normalizarTexto(atribuido);

  // Se o campo Atribuído estiver vazio ou n/a:
  // Executor = proprietário
  // Proprietário da atividade = proprietário
  if (!atribuido || atribuidoNorm === "n/a") {
    Logger.log(
      `Setor "${setorNorm}": campo atribuído vazio ou n/a. Usando proprietário.`
    );

    return _retornoProprietario(proprietario);
  }

  // Se tiver alguém atribuído:
  // Executor = atribuído do setor
  // Proprietário da atividade = proprietário do imóvel
  Logger.log(
    `Setor "${setorNorm}": executor definido pelo campo "${campo.nome}" → "${atribuido}". Proprietário da atividade → "${proprietario}".`
  );

  return _montarResultado(
    atribuido,
    TIPO_INTERNO,
    proprietario,
    TIPO_INTERNO
  );
}
if (sn === "ccv") {
  if (execContratoNorm.includes("smart")) {
    return _retornoProprietario(proprietario);
  }

  if (execContratoNorm.includes("parceiro")) {
    return _retornoParceiro(deal);
  }

  Logger.log(`CCV: Executor Contrato="${execContrato}" não enquadrado.`);
  return null;
}

if (sn === "escritura publica") {
  if (execContratoNorm.includes("externo")) {
    return _retornoProprietario(proprietario);
  }

  if (execContratoNorm.includes("parceiro")) {
    return _retornoParceiro(deal);
  }

  Logger.log(`Escritura: Executor Contrato="${execContrato}" não enquadrado.`);
  return null;
}

  // ── 2d. FGTS à vista ──────────────────────────────────────────────────
  //   "Smart" ou "Externo" → proprietário
  

  // ── 2e. Registro ──────────────────────────────────────────────────────
  //   "Smart" ou "Externo" → proprietário
  //   "Parceiro"           → parceiro responsável + Pedro Rocha
  //   Demais               → fallback Grupo 1 (parceiro → Pedro Rocha, ou proprietário)
 if (sn === "registro") {
  Logger.log(
    `REGISTRO | Executor Registro raw: "${execRegistroRaw}" | norm: "${execRegistroNorm}"`
  );

  if (!execRegistroNorm) {
    Logger.log("REGISTRO: campo Executor Registro vazio ou não encontrado no Pipedrive.");
    return null;
  }

  if (
    execRegistroNorm.includes("smart") ||
    execRegistroNorm.includes("externo")
  ) {
    return _retornoProprietario(proprietario);
  }

  if (execRegistroNorm.includes("parceiro")) {
    return _retornoParceiro(deal);
  }

if (execRegistroNorm.includes("terceiro")) {
  var retornoParceiroRegistro = _retornoParceiro(deal);

  if (retornoParceiroRegistro) {
    Logger.log(
      `REGISTRO: executor "${execRegistroRaw}" identificado como Terceiro. ` +
      `Usando Parceiro Responsável: "${retornoParceiroRegistro.executor}".`
    );

    return retornoParceiroRegistro;
  }

  return _montarResultado(
    execRegistroRaw,
    TIPO_EXTERNO,
    USUARIO_PEDRO_ROCHA,
    TIPO_INTERNO
  );
}

  Logger.log(`REGISTRO: Executor Registro="${execRegistroRaw}" não enquadrado.`);
  return null;
}

  // ── 2f. Titularidade ──────────────────────────────────────────────────
  //   "Smart" ou "Externo" → proprietário
  //   "Parceiro"           → parceiro responsável + Pedro Rocha
  //   Demais               → fallback Grupo 1
 if (sn === "troca de titularidade" || sn === "titularidade") {
  return _retornoPorExecutorEtapa_(
    "TITULARIDADE",
    execTitularidadeRaw,
    execTitularidadeNorm,
    proprietario,
    deal
  );
}

  // ── 2g. ITBI ──────────────────────────────────────────────────────────
  //   "Smart" ou "Externo" → proprietário
  //   "Parceiro"           → parceiro responsável + Pedro Rocha
  //   Demais               → fallback Grupo 1
if (sn === "itbi") {
  return _retornoPorExecutorEtapa_(
    "ITBI",
    execItbiRaw,
    execItbiNorm,
    proprietario,
    deal
  );
}

  // ── 3. Contrato (lógica original do Grupo 1) ──────────────────────────
  //   Parceiro responsável informado → executor = parceiro, responsável = Pedro Rocha
  //   Sem parceiro                   → executor = proprietário, responsável = proprietário
 if (sn.includes("contrato")) {
  return _fallbackGrupo1(deal, proprietario);
}
  // ── 4. Grupo 2: condomínio | desocupação | IPTU ───────────────────────
  //   Usa o campo "Atribuído" específico de cada setor
if (SETORES_GRUPO2.includes(sn)) {
  const campo = _campoAtribuidoPorSetorNorm(sn);
  const atribuido = _resolverOpcao(deal, campo) || "";
  const atribuidoNorm = _normalizarTexto(atribuido);

  if (!atribuido || atribuidoNorm === "n/a") {
    return _retornoProprietario(proprietario);
  }

  return _montarResultado(
    atribuido,
    TIPO_INTERNO,
    proprietario,
    TIPO_INTERNO
  );
}

  // Setor não reconhecido por nenhuma regra
  Logger.log(`Setor "${setor}" (norm: "${sn}") não mapeado em nenhum grupo.`);
  return null;
}


// ══════════════════════════════════════════════════════════════
//  SEÇÃO 9 – HELPERS DE RETORNO
// ══════════════════════════════════════════════════════════════
function isSetorFinanciamento_(setor) {
  return String(setor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, ' ')
    .replace(/[-_\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() === 'financiamento';
}
function isSetorCcaSmart_(setor) {
  return String(setor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, ' ')
    .replace(/[-_\/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() === 'cca smart';
}


function _obterLabelOpcaoCampo_(campo, valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "";
  }

  let valorComparacao = valor;

  if (typeof valor === "object") {
    if (valor.id !== undefined) {
      valorComparacao = valor.id;
    } else if (valor.value !== undefined) {
      valorComparacao = valor.value;
    } else if (valor.label !== undefined) {
      valorComparacao = valor.label;
    } else if (valor.name !== undefined) {
      valorComparacao = valor.name;
    }
  }

  const valorTexto = String(valorComparacao).trim();

  const opcoes = Array.isArray(campo.options)
    ? campo.options
    : Object.keys(campo.options || {}).map(function(id) {
        return {
          id: id,
          label: campo.options[id]
        };
      });

  const opcao = opcoes.find(function(op) {
    return String(op.id) === valorTexto ||
           _normalizarTexto(op.label) === _normalizarTexto(valorTexto);
  });

  return opcao ? opcao.label : valorTexto;
}

function _montarResultado(executor, tipoExecutor, responsavelAtividade, tipoResponsavelAtividade) {
  return {
    executor,
    tipoExecutor,
    responsavelAtividade,
    tipoResponsavelAtividade
  };
}

/** Ambos executor e responsável = proprietário do imóvel (sempre interno) */
function _retornoProprietario(proprietario) {
  return _montarResultado(
    proprietario,
    TIPO_INTERNO,
    proprietario,
    TIPO_INTERNO
  );
}

/**
 * Executor = Parceiro Responsável do negócio (sempre externo)
 * Responsável pela atividade = Pedro Rocha (sempre interno)
 */
function _retornoParceiro(deal) {
  const parceiro = _resolverOpcao(deal, CAMPO_PARCEIRO) || "";
  const parceiroNorm = _normalizarTexto(parceiro);

  if (!parceiro || parceiroNorm === "n/a") {
    Logger.log("Executor Contrato = Parceiro/Terceiro, mas Parceiro Responsável está vazio ou n/a.");
    return null;
  }

  return _montarResultado(
    parceiro,
    "Parceiro",
    USUARIO_PEDRO_ROCHA,
    TIPO_INTERNO
  );
}

/**
 * Lógica original do Grupo 1:
 *  - Se parceiro responsável informado (e diferente de "n/a") →
 *      executor = parceiro (externo)
 *      responsável = Pedro Rocha (interno)
 *  - Caso contrário →
 *      executor = proprietário (interno)
 *      responsável = proprietário (interno)
 */
function _fallbackGrupo1(deal, proprietario) {
  const parceiro = _resolverOpcao(deal, CAMPO_PARCEIRO);

  if (parceiro && _normalizarTexto(parceiro) !== "n/a") {
    return _montarResultado(
      parceiro,
      TIPO_EXTERNO,
      USUARIO_PEDRO_ROCHA,
      TIPO_INTERNO
    );
  }

  return _retornoProprietario(proprietario);
}

// ══════════════════════════════════════════════════════════════
//  SEÇÃO 10 – GRAVAÇÃO NA PLANILHA
// ══════════════════════════════════════════════════════════════

function obterOpcoesValidacaoCelula_(cell) {
  var rule = cell.getDataValidation();

  if (!rule) {
    Logger.log('Célula de executor sem validação.');
    return [];
  }

  var criteriaType = rule.getCriteriaType();
  var criteriaValues = rule.getCriteriaValues();

  if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return (criteriaValues[0] || [])
      .map(function(v) {
        return String(v || '').trim();
      })
      .filter(Boolean);
  }

  if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    var range = criteriaValues[0];

    if (!range) return [];

    return range
      .getDisplayValues()
      .flat()
      .map(function(v) {
        return String(v || '').trim();
      })
      .filter(Boolean);
  }

  Logger.log('Tipo de validação da célula de executor não suportado: ' + criteriaType);
  return [];
}

function resolverExecutorNaListaValidacao_(cellExecutor, resultado) {
  var opcoes = obterOpcoesValidacaoCelula_(cellExecutor);

  if (!opcoes.length) {
    Logger.log('Nenhuma opção encontrada na validação da célula de executor.');
    return '';
  }

  var tipo = String(resultado.tipoExecutor || '').trim();
  var executor = String(resultado.executor || '').trim();

  if (!executor) return '';

  var candidatos = montarCandidatosExecutor_(tipo, executor);

  Logger.log(
    'Tentando resolver executor na lista. tipo="' +
    tipo +
    '", executor="' +
    executor +
    '", candidatos=' +
    JSON.stringify(candidatos)
  );

  for (var i = 0; i < candidatos.length; i++) {
    var encontrado = buscarMelhorOpcaoExecutor_(candidatos[i], opcoes);

    if (encontrado) {
      Logger.log(
        'Executor resolvido. Candidato="' +
        candidatos[i] +
        '" → opção="' +
        encontrado +
        '"'
      );

      return encontrado;
    }
  }

  Logger.log(
    'Executor não encontrado na lista. tipo="' +
    tipo +
    '", executor="' +
    executor +
    '".'
  );

  return '';
}

function montarCandidatosExecutor_(tipo, executor) {
  var candidatos = [];

  var tipoNorm = _normalizarTexto(tipo);
  var executorLimpo = limparExecutorParaComparacao_(executor);

  candidatos.push(executor);
  candidatos.push(executorLimpo);

  if (tipoNorm === 'interno') {
    candidatos.push('Interno - ' + executorLimpo);
  }

  if (tipoNorm === 'externo' || tipoNorm === 'parceiro') {
    candidatos.push('Parceiro - ' + executorLimpo);
    candidatos.push('Parceiro - Cartório - ' + executorLimpo);
    candidatos.push('Cartório - ' + executorLimpo);
  }

  var matchUfNome = executorLimpo.match(/^([A-Z]{2})\s*[-–—]\s*(.+)$/i);

  if (matchUfNome) {
    var uf = matchUfNome[1].toUpperCase();
    var nome = matchUfNome[2].trim();

    candidatos.push(nome);
    candidatos.push(nome + ' - ' + uf);
    candidatos.push('Cartório - ' + nome + ' - ' + uf);
    candidatos.push('Parceiro - Cartório - ' + nome + ' - ' + uf);
  }

  var partes = executorLimpo
    .split('-')
    .map(function(p) {
      return String(p || '').trim();
    })
    .filter(Boolean);

  if (partes.length >= 2) {
    candidatos.push(partes.join(' '));

    var penultimo = partes[partes.length - 2];
    var ultimo = partes[partes.length - 1];

    candidatos.push(penultimo + ' - ' + ultimo);
    candidatos.push('Parceiro - Cartório - ' + penultimo + ' - ' + ultimo);
  }

  return removerDuplicadosTexto_(candidatos);
}

function buscarMelhorOpcaoExecutor_(valorDesejado, opcoes) {
  var desejadoNorm = _normalizarTexto(valorDesejado);

  if (!desejadoNorm) return '';

  for (var i = 0; i < opcoes.length; i++) {
    if (_normalizarTexto(opcoes[i]) === desejadoNorm) {
      return opcoes[i];
    }
  }

  var tokensDesejado = extrairTokensExecutor_(desejadoNorm);

  if (!tokensDesejado.length) return '';

  var melhorOpcao = '';
  var melhorScore = 0;
  var empates = 0;

  for (var j = 0; j < opcoes.length; j++) {
    var opcao = opcoes[j];
    var opcaoNorm = _normalizarTexto(opcao);
    var tokensOpcao = extrairTokensExecutor_(opcaoNorm);

    var score = calcularScoreTokens_(tokensDesejado, tokensOpcao, desejadoNorm, opcaoNorm);

    if (score > melhorScore) {
      melhorScore = score;
      melhorOpcao = opcao;
      empates = 1;
    } else if (score === melhorScore && score > 0) {
      empates++;
    }
  }

  if (melhorScore >= 70 && empates === 1) {
    return melhorOpcao;
  }

  if (melhorScore >= 70 && empates > 1) {
    Logger.log(
      'Mais de uma opção possível para "' +
      valorDesejado +
      '". Melhor score=' +
      melhorScore +
      '. Não selecionado por segurança.'
    );
  }

  return '';
}

function limparExecutorParaComparacao_(texto) {
  return String(texto || '')
    .replace(/\(Você\)/gi, '')
    .replace(/^\s*interno\s*[-–—:]\s*/i, '')
    .replace(/^\s*externo\s*[-–—:]\s*/i, '')
    .replace(/^\s*parceiro\s*[-–—:]\s*/i, '')
    .replace(/^\s*cart[oó]rio\s*[-–—:]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairTokensExecutor_(textoNorm) {
  var ignorar = {
    'interno': true,
    'externo': true,
    'parceiro': true,
    'cartorio': true,
    'cca': true,
    'terceiro': true,
    'substituto': true,
    'n': true,
    'a': true
  };

  return String(textoNorm || '')
    .split(/\s+/)
    .map(function(t) {
      return String(t || '').trim();
    })
    .filter(function(t) {
      return t && !ignorar[t];
    });
}

function calcularScoreTokens_(tokensDesejado, tokensOpcao, desejadoNorm, opcaoNorm) {
  var score = 0;

  if (opcaoNorm.indexOf(desejadoNorm) !== -1 || desejadoNorm.indexOf(opcaoNorm) !== -1) {
    score += 50;
  }

  for (var i = 0; i < tokensDesejado.length; i++) {
    var token = tokensDesejado[i];

    if (tokensOpcao.indexOf(token) !== -1) {
      score += 25;
      continue;
    }

    for (var j = 0; j < tokensOpcao.length; j++) {
      if (
        tokensOpcao[j].indexOf(token) !== -1 ||
        token.indexOf(tokensOpcao[j]) !== -1
      ) {
        score += 12;
        break;
      }
    }
  }

  return score;
}

function removerDuplicadosTexto_(lista) {
  var vistos = {};
  var saida = [];

  for (var i = 0; i < lista.length; i++) {
    var valor = String(lista[i] || '').trim();
    var norm = _normalizarTexto(valor);

    if (!valor || vistos[norm]) continue;

    vistos[norm] = true;
    saida.push(valor);
  }

  return saida;
}



function _retornoPorExecutorEtapa_(nomeEtapa, executorRaw, executorNorm, proprietario, deal) {
  Logger.log(
    `${nomeEtapa} | Executor raw: "${executorRaw}" | norm: "${executorNorm}"`
  );

  if (!executorNorm) {
    Logger.log(`${nomeEtapa}: campo de executor vazio ou não encontrado no Pipedrive.`);
    return null;
  }

  if (
    executorNorm.includes("smart") ||
    executorNorm.includes("externo") ||
    executorNorm.includes("cliente")
  ) {
    return _retornoProprietario(proprietario);
  }

  if (executorNorm.includes("parceiro")) {
    return _retornoParceiro(deal);
  }

  if (executorNorm.includes("terceiro")) {
  var retornoParceiroTerceiro = _retornoParceiro(deal);

  if (retornoParceiroTerceiro) {
    Logger.log(
      `${nomeEtapa}: executor "${executorRaw}" identificado como Terceiro. ` +
      `Usando Parceiro Responsável: "${retornoParceiroTerceiro.executor}".`
    );

    return retornoParceiroTerceiro;
  }

  return _montarResultado(
    executorRaw,
    TIPO_EXTERNO,
    USUARIO_PEDRO_ROCHA,
    TIPO_INTERNO
  );
}
  Logger.log(`${nomeEtapa}: executor "${executorRaw}" não enquadrado.`);
  return null;
}





function _resolverValorValidadoParaR(sheet, row, valorDesejado) {
  if (!valorDesejado) return "";

  const cell = sheet.getRange(row, COL_PROPRIETARIO_ATIVIDADE);
  const rule = cell.getDataValidation();

  if (!rule) return valorDesejado;

  const criteriaType = rule.getCriteriaType();
  const criteriaValues = rule.getCriteriaValues();

  // Caso seja validação por lista explícita
  if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    const opcoes = criteriaValues[0] || [];

    // 1. Match exato
    const exato = opcoes.find(op => String(op).trim() === String(valorDesejado).trim());
    if (exato) return exato;

    // 2. Match por conteúdo
    const desejadoNorm = _normalizarTexto(valorDesejado);
    const parcial = opcoes.find(op => _normalizarTexto(op).includes(desejadoNorm));
    if (parcial) return parcial;

    // 3. Sem match
    Logger.log(`⚠️ Nenhuma opção válida encontrada em R para "${valorDesejado}"`);
    Logger.log(`Opções disponíveis: ${JSON.stringify(opcoes)}`);
    return "";
  }

  return valorDesejado;
}

function _garantirOpcaoNaValidacao(cell, novoValor) {
  if (!novoValor) return "";

  const rule = cell.getDataValidation();
  if (!rule) return novoValor;

  const type = rule.getCriteriaType();
  const values = rule.getCriteriaValues();

  // Lista fixa
  if (type === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    const lista = (values[0] || []).map(v => String(v).trim());
    const existe = lista.includes(novoValor);

    if (!existe) {
      lista.push(novoValor);

      const novaRegra = SpreadsheetApp.newDataValidation()
        .requireValueInList(lista, true)
        .setAllowInvalid(false)
        .build();

      cell.setDataValidation(novaRegra);

      Logger.log(`✅ Adicionado na validação: "${novoValor}"`);
    }

    return novoValor;
  }

  return novoValor;
}



function _gravarResultado(sheet, row, resultado) {
  const cellR = sheet.getRange(row, COL_PROPRIETARIO_ATIVIDADE);
  const cellS = sheet.getRange(row, COL_EXECUTOR);

  // R → proprietário/responsável da atividade
  const valorR = _garantirOpcaoNaValidacao(
    cellR,
    resultado.responsavelAtividade
  );

  cellR.setValue(valorR);
  const setor = _lerCelula(sheet, row, COL_SETOR);

  // REGRA ESPECIAL:
  // Financiamento:
  // - preenche proprietário
  // - não preenche executor
  // - proprietário do imóvel em U
  // - líder definido como Kauã Amorim
  if (isSetorFinanciamento_(setor)) {
    cellS.clearContent();

    preencherLiderFinanciamentoDaLinha_(sheet, row);

    Logger.log(
      `Linha ${row}: setor "${setor}". Proprietário preenchido, executor manual e líder Kauã Amorim.`
    );

    return;
  }

// S → executor escolhido a partir da lista de validação existente
const valorSAjustado = resolverExecutorNaListaValidacao_(cellS, resultado);

if (!valorSAjustado) {
  Logger.log(
    `Linha ${row}: executor não preenchido porque não foi encontrada opção compatível na lista. ` +
    `tipo="${resultado.tipoExecutor}", executor="${resultado.executor}".`
  );
  return;
}

cellS.setValue(valorSAjustado);

// Líder normal pelo executor selecionado
preencherLiderDaLinha_(sheet, row, valorSAjustado);
}

function _formatarExecutor(nome, tipo) {
  if (!nome) return "";
  return `${tipo} - ${nome}`;
}

// ══════════════════════════════════════════════════════════════
//  SEÇÃO 11 – UTILITÁRIOS
// ══════════════════════════════════════════════════════════════

/**
 * Normaliza texto para comparação: minúsculo, sem acentos, sem espaços extras.
 * Exemplos:
 *   "Pré Arrematação" → "pre arrematacao"
 *   "CONDOMÍNIO"      → "condominio"
 *   "FGTS à vista"    → "fgts a vista"
 */
function _normalizarTexto(texto) {
  if (!texto) return "";

  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\/\\]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function _lerCelula(sheet, row, col) {
  const val = sheet.getRange(row, col).getValue();
  return val !== null && val !== undefined ? String(val) : "";
}

/**
 * Resolve o valor de um campo customizado do Pipedrive.
 * Suporta: objeto com .label, objeto com .id (busca em campo.options), número (busca em options), string.
 */
function _resolverOpcao(deal, campo) {
  const valor = deal[campo.key];
  if (valor === null || valor === undefined || valor === "") return "";

  if (typeof valor === "object" && valor !== null) {
    if (valor.label) return valor.label;
    if (valor.id)    return (campo.options && campo.options[valor.id]) || String(valor.id);
  }

  const id = parseInt(valor, 10);
  if (!isNaN(id) && campo.options) return campo.options[id] || String(id);

  return String(valor);
}

function _resolverProprietario(deal) {
  const campo = deal[CAMPO_PROPRIETARIO.key];
  if (campo) {
    if (typeof campo === "object" && campo.name) return campo.name;
    return String(campo);
  }
  return deal.owner_name || "";
}

function _campoAtribuidoPorSetorNorm(setorNorm) {
  if (setorNorm === "iptu")        return CAMPO_ATRIBUIDO_IPTU;
  if (setorNorm === "condominio")  return CAMPO_ATRIBUIDO_COND;
  if (setorNorm === "desocupacao") return CAMPO_ATRIBUIDO_DESOC;
  return CAMPO_ATRIBUIDO_IPTU; // fallback seguro
}
function preencherLiderResponsavelLinha(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetOuvidoria = ss.getSheetByName("Ouvidoria");
  const sheetEquipe = ss.getSheetByName(NOME_ABA_EQUIPE);

  if (!sheetOuvidoria) {
    throw new Error('Aba "Ouvidoria" não encontrada.');
  }

  if (!sheetEquipe) {
    throw new Error('Aba "equipe" não encontrada.');
  }

  const executorRaw = _lerCelula(sheetOuvidoria, row, COL_EXECUTOR).trim();
  if (!executorRaw) {
    Logger.log(`Linha ${row}: executor vazio na coluna V.`);
    return;
  }

  preencherLiderDaLinha_(sheetOuvidoria, row, executorRaw);
}

function _extrairNomesExecutores_(executorRaw) {
  let texto = String(executorRaw || "").trim();

  // Usa sua função atual, caso ela já remova algum prefixo
  if (typeof _extrairNomeExecutor === "function") {
    texto = _extrairNomeExecutor(texto);
  }

  texto = String(texto || "").trim();

  // Remove prefixos comuns, como "Interno - Camila Ferreira"
  texto = texto.replace(/^\s*interno\s*-\s*/i, "");
texto = texto.replace(/^\s*externo\s*-\s*/i, "");
texto = texto.replace(/^\s*cca\s+/i, "");

  // Separa nomes quando vierem assim:
  // "Camila Ferreira | Marcus Moura"
 return texto
  .split("|")
  .map(function(nome) {
    return nome
      .replace(/^\s*cca\s+/i, "")
      .trim();
  })
  .filter(function(nome) {
    return nome !== "";
  });
}


function preencherLiderResponsavelTodasAsLinhas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetOuvidoria = ss.getSheetByName("Ouvidoria");

  if (!sheetOuvidoria) {
    throw new Error('Aba "Ouvidoria" não encontrada.');
  }

  const lastRow = sheetOuvidoria.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    preencherLiderResponsavelLinha(row);
  }

  SpreadsheetApp.getUi().alert("Preenchimento de líderes concluído.");
}

function _extrairNomeExecutor(executorRaw) {
  if (!executorRaw) return "";

  return String(executorRaw)
    .replace(/^Interno\s*-\s*/i, "")
    .replace(/^Externo\s*-\s*/i, "")
    .trim();
}

function _buscarLiderPorFuncionario(sheetEquipe, nomeFuncionario) {
  if (!nomeFuncionario) return "";

  const lastRow = sheetEquipe.getLastRow();

  if (lastRow < 2) return "";

  const totalRows = lastRow - 1;

  const funcionarios = sheetEquipe
    .getRange(2, COL_EQUIPE_FUNCIONARIO, totalRows, 1)
    .getValues();

  const lideres = sheetEquipe
    .getRange(2, COL_EQUIPE_LIDER, totalRows, 1)
    .getValues();

  const nomeNorm = _normalizarTexto(nomeFuncionario);

  for (let i = 0; i < totalRows; i++) {
    const funcionario = funcionarios[i][0];
    const lider = lideres[i][0];

    if (_normalizarTexto(funcionario) === nomeNorm) {
      return lider ? String(lider).trim() : "";
    }
  }

  return "";
}

// ══════════════════════════════════════════════════════════════
//  SEÇÃO 12 – REPROCESSAMENTO EM LOTE
// ══════════════════════════════════════════════════════════════

function reprocessarTodasAsLinhas() {
  const sheet   = _getSheetOuvidoria();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("Nenhuma linha de dados encontrada.");
    return;
  }

  let processadas = 0;
  for (let row = 2; row <= lastRow; row++) {
    const setor = _lerCelula(sheet, row, COL_SETOR).trim();
    if (!setor) continue;
    _processarLinha(sheet, row);
    processadas++;
    Utilities.sleep(300);
  }

  SpreadsheetApp.getUi().alert(`Concluído: ${processadas} linha(s) processada(s).`);
}


// ══════════════════════════════════════════════════════════════
//  SEÇÃO 13 – TESTE MANUAL (linha específica)
// ══════════════════════════════════════════════════════════════

function testarValidacaoLinha2ComLog() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const row   = 2082;

  Logger.log("═══════════════════════════════════════");
  Logger.log(`🚀 TESTE COMPLETO - LINHA ${row}`);
  Logger.log("═══════════════════════════════════════");

  // 1. CONTEXTO DA PLANILHA
  const setorOriginal = _lerCelula(sheet, row, COL_SETOR);
  const codigoImovel  = _lerCelula(sheet, row, COL_CODIGO_IMOVEL);
  const setorNorm     = _normalizarTexto(setorOriginal);

  Logger.log("📄 DADOS DA PLANILHA:");
  Logger.log(`Setor (original): "${setorOriginal}" | normalizado: "${setorNorm}"`);
  Logger.log(`Código do imóvel: "${codigoImovel}"`);

  // 2. BUSCA NO PIPEDRIVE
  Logger.log("🔎 Buscando deal no Pipedrive...");
  const deal = _buscarDealPorCodigoImovel(codigoImovel);

  if (!deal) {
    Logger.log("❌ Deal NÃO encontrado.");
    return;
  }
  Logger.log(`✅ Deal encontrado | ID: ${deal.id} | Título: ${deal.title}`);
  const proponente = _resolverNomeArrematante(deal);

Logger.log("NOME ARREMATANTE RESOLVIDO: " + proponente);

_gravarProponente(sheet, row, proponente);

  // 3. EXTRAÇÃO DOS CAMPOS
  const parceiro        = _resolverOpcao(deal, CAMPO_PARCEIRO);
  const proprietario    = _resolverProprietario(deal);
  const execContrato    = _resolverOpcao(deal, CAMPO_EXECUTOR_CONTRATO);
  const iptu            = _resolverOpcao(deal, CAMPO_ATRIBUIDO_IPTU);
  const condominio      = _resolverOpcao(deal, CAMPO_ATRIBUIDO_COND);
  const desocupacao     = _resolverOpcao(deal, CAMPO_ATRIBUIDO_DESOC);

  Logger.log("📦 DADOS EXTRAÍDOS DO PIPE:");
  Logger.log(`Parceiro Responsável : ${parceiro}`);
  Logger.log(`Proprietário         : ${proprietario}`);
  Logger.log(`Executor: Contrato   : ${execContrato} (norm: "${_normalizarTexto(execContrato)}")`);
  Logger.log(`Atribuído IPTU       : ${iptu}`);
  Logger.log(`Atribuído Condomínio : ${condominio}`);
  Logger.log(`Atribuído Desocupação: ${desocupacao}`);

  // 4. REGRA DE NEGÓCIO
  Logger.log("🧠 APLICANDO REGRA DE NEGÓCIO...");
  const resultado = _definirExecutorEAtividade(deal, setorOriginal);

  if (!resultado) {
    Logger.log(`❌ Setor "${setorOriginal}" (norm: "${setorNorm}") não mapeado.`);
    return;
  }

  Logger.log("🎯 RESULTADO FINAL:");
  Logger.log(`Executor             : ${resultado.executor}`);
  Logger.log(`Responsável Atividade: ${resultado.responsavelAtividade}`);

  // 5. GRAVAÇÃO
  _gravarResultado(sheet, row, resultado);
  Logger.log("✅ Resultado gravado na planilha (coluna V)");

  Logger.log("═══════════════════════════════════════");
  Logger.log("🏁 FIM DO TESTE");
  Logger.log("═══════════════════════════════════════");
}
