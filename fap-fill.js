/*
 * fap-fill.js — preenche o FAP.xlsx (formulário SUNSET) célula a célula,
 * editando só o sheet1.xml dentro do zip (preserva 100% formatação/logo).
 * Funciona no browser (window.FapFill) e no Node (module.exports).
 *
 * Mapa de células mapeado a partir do FAP.xlsx original (v. README).
 */
(function (root) {
  'use strict';

  // ---- Dados fixos do Importador/Distribuidor (Fila B) ----
  var IMPORTADOR = {
    nome: 'FLRS DISTRIBUIDORA DE PNEUS - PNEUTOP',
    endereco: 'Fazenda Taquaral - Agua da Cabiuna, 3 - Rural',
    cep: '19.801-140',
    cidade: 'Assis',
    uf: 'SP',
    fone: '(11) 99872-8650',
    cnpj: '14.465.970/0001-77',
    ie: '189.097.445.112'
  };

  // ---- Mapa: campo -> célula (Filas A a H). "X" nas caixas de seleção. ----
  // Fila B (importador) — preenchido a partir de IMPORTADOR
  var CELLS_IMPORTADOR = {
    nome: 'T8', endereco: 'F9', cep: 'Z9', cidade: 'F10',
    uf: 'U10', fone: 'AA10', cnpj: 'E11', ie: 'V11'
  };

  // helper p/ escapar XML
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Escreve string (inlineStr) numa célula vazia self-closing, preservando estilo.
  function setStr(xml, ref, value) {
    if (value == null || value === '') return xml;
    var re = new RegExp('<c r="' + ref + '"([^>]*?)/>');
    var repl = '<c r="' + ref + '"$1 t="inlineStr"><is><t xml:space="preserve">' + esc(value) + '</t></is></c>';
    if (re.test(xml)) return xml.replace(re, repl);
    // fallback: célula já existe com conteúdo t="s"/inlineStr — troca o miolo mantendo atributos (sem t=s)
    var re2 = new RegExp('<c r="' + ref + '"([^>]*?)(?:\\s+t="[^"]*")?>[\\s\\S]*?</c>');
    if (re2.test(xml)) return xml.replace(re2, '<c r="' + ref + '"$1 t="inlineStr"><is><t xml:space="preserve">' + esc(value) + '</t></is></c>');
    return xml;
  }

  // Escreve número numa célula (usada em Original/Encontrada mm, que têm <v>0</v>).
  function setNum(xml, ref, value) {
    if (value == null || value === '') return xml;
    var num = String(value).replace(',', '.');
    if (isNaN(parseFloat(num))) return xml;
    var reV = new RegExp('(<c r="' + ref + '"[^>]*?>)<v>[^<]*</v></c>');
    if (reV.test(xml)) return xml.replace(reV, '$1<v>' + parseFloat(num) + '</v></c>');
    var reE = new RegExp('<c r="' + ref + '"([^>]*?)/>');
    if (reE.test(xml)) return xml.replace(reE, '<c r="' + ref + '"$1><v>' + parseFloat(num) + '</v></c>');
    return xml;
  }

  function mark(xml, ref, on) { return on ? setStr(xml, ref, 'X') : xml; }

  // Preenche o sheet1.xml a partir do objeto data (ver estrutura no frontend).
  function fillSheetXml(xml, data) {
    var d = data || {};

    // ---- Fila B: Importador (fixo) ----
    Object.keys(CELLS_IMPORTADOR).forEach(function (k) {
      xml = setStr(xml, CELLS_IMPORTADOR[k], IMPORTADOR[k]);
    });

    // ---- NF da venda ao consumidor (Fila B, parte variável) ----
    var nf = d.nf || {};
    xml = setStr(xml, 'G12', nf.numero);
    xml = setStr(xml, 'S12', nf.serie);
    xml = setStr(xml, 'AA12', d.dataEnvio || nf.data);

    // ---- Fila A: Consumidor ----
    var c = d.consumidor || {};
    xml = setStr(xml, 'G4', c.nome);
    xml = setStr(xml, 'F5', c.endereco);
    xml = setStr(xml, 'F6', c.cidade);
    xml = setStr(xml, 'M6', c.cep);
    xml = setStr(xml, 'R6', c.uf);
    xml = setStr(xml, 'F7', c.telefone);
    xml = setStr(xml, 'M7', c.email);

    // ---- Fila A: Revendedor (se houver) ----
    var r = d.revendedor || {};
    xml = setStr(xml, 'W4', r.nome);
    xml = setStr(xml, 'V5', r.endereco);
    xml = setStr(xml, 'V6', r.cidade);
    xml = setStr(xml, 'AC6', r.cep);
    xml = setStr(xml, 'AH6', r.uf);
    xml = setStr(xml, 'V7', r.telefone);
    xml = setStr(xml, 'AC7', r.email);

    // ---- Fila C: Produto (Pneu já vem marcado no template em N13) ----
    var p = d.produto || {};
    xml = setStr(xml, 'H15', p.medida);
    xml = setStr(xml, 'K15', p.modelo);
    xml = setStr(xml, 'N15', p.marca);
    xml = setStr(xml, 'R15', p.lonas);      // Cap.LONAS/IC.IV
    xml = setStr(xml, 'W15', p.serie);      // Série (linha de cima)
    xml = setStr(xml, 'W16', p.dot);        // DOT (linha de baixo)
    xml = setStr(xml, 'AD15', p.km);        // KM do produto

    // ---- Fila D: Veículo ----
    var v = d.veiculo || {};
    xml = setStr(xml, 'E18', v.marca);
    xml = setStr(xml, 'L18', v.modelo);
    xml = setStr(xml, 'Q18', v.versao);
    xml = setStr(xml, 'X18', v.ano);
    xml = setStr(xml, 'AE18', v.placa);
    xml = mark(xml, 'F19', v.blindado === 'sim');
    xml = mark(xml, 'J19', v.blindado === 'nao');
    xml = mark(xml, 'V19', v.eletrico === 'sim');
    xml = mark(xml, 'Y19', v.eletrico === 'nao');

    // ---- Fila E: Condição de uso ----
    var u = d.uso || {};
    // Tipo de estrada (caixa ANTES do rótulo)
    xml = mark(xml, 'H21', u.estrada === 'asfaltada');
    xml = mark(xml, 'L21', u.estrada === 'terra');
    xml = mark(xml, 'Q21', u.estrada === 'pedras');
    xml = mark(xml, 'W21', u.estrada === 'mista');
    // Posição de uso (caixa DEPOIS do rótulo) — pode ser múltipla
    var pos = u.posicao || [];
    xml = mark(xml, 'K22', pos.indexOf('dianteiro') >= 0);
    xml = mark(xml, 'O22', pos.indexOf('traseiro') >= 0);
    xml = mark(xml, 'T22', pos.indexOf('reboque') >= 0);
    xml = mark(xml, 'X22', pos.indexOf('ladoEsq') >= 0);
    xml = mark(xml, 'AB22', pos.indexOf('ladoDir') >= 0);
    xml = mark(xml, 'AE22', pos.indexOf('int') >= 0);
    xml = mark(xml, 'AH22', pos.indexOf('ext') >= 0);
    // Tipo de serviço (caixa ANTES do rótulo)
    xml = mark(xml, 'H23', u.servico === 'passeio');
    xml = mark(xml, 'K23', u.servico === 'taxi');
    xml = mark(xml, 'N23', u.servico === 'onibus');
    xml = mark(xml, 'Q23', u.servico === 'caminhao');
    xml = mark(xml, 'U23', u.servico === 'caminhonete');
    xml = mark(xml, 'Y23', u.servico === 'vanVuc');
    xml = mark(xml, 'AC23', u.servico === 'outros');

    // ---- Fila F: Defeito alegado ----
    xml = setStr(xml, 'L24', d.defeito);

    // ---- Fila G: Danos/Vítimas + Declaração ----
    var g = d.danos || {};
    xml = mark(xml, 'K28', g.materiais === 'sim');
    xml = mark(xml, 'N28', g.materiais === 'nao');
    xml = mark(xml, 'X28', g.vitimas === 'sim');
    xml = mark(xml, 'AB28', g.vitimas === 'nao');
    xml = setStr(xml, 'D29', c.nome);       // "Eu, <nome>"
    xml = setStr(xml, 'V29', c.rg);
    xml = setStr(xml, 'AC29', c.cpf);

    // ---- Fila H: Profundidade do sulco ----
    var h = d.sulco || {};
    xml = setNum(xml, 'C48', h.original);
    xml = setNum(xml, 'I48', h.encontrada);

    return xml;
  }

  // fillFap(JSZip, templateBytes, data) -> Promise<Uint8Array (node) | Blob (browser)>
  function fillFap(JSZip, templateBytes, data) {
    return JSZip.loadAsync(templateBytes).then(function (zip) {
      var path = 'xl/worksheets/sheet1.xml';
      return zip.file(path).async('string').then(function (xml) {
        zip.file(path, fillSheetXml(xml, data));
        var isNode = typeof window === 'undefined';
        return zip.generateAsync({
          type: isNode ? 'nodebuffer' : 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          compression: 'DEFLATE'
        });
      });
    });
  }

  var api = { fillFap: fillFap, fillSheetXml: fillSheetXml, IMPORTADOR: IMPORTADOR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FapFill = api;
})(typeof self !== 'undefined' ? self : this);
