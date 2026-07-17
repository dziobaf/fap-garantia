const fs = require('fs');
const JSZip = require('jszip');
const { fillFap } = require('../fap-fill.js');

const template = fs.readFileSync(__dirname + '/../FAP_sunset.xlsx');

const data = {
  dataEnvio: '17/07/2026',
  nf: { numero: '094572', serie: '1', data: '17/07/2026' },
  consumidor: {
    nome: 'João Paulo da Silva', endereco: 'Rua das Flores, 100',
    cidade: 'Assis', cep: '19800-000', uf: 'SP',
    telefone: '(18) 99999-0000', email: 'joao@teste.com',
    rg: '12.345.678-9', cpf: '123.456.789-00'
  },
  revendedor: { nome: 'Auto Center XYZ', cidade: 'Marília', uf: 'SP', telefone: '(14) 3333-0000' },
  produto: {
    medida: '195/65R15', modelo: 'ECOLOGY', marca: 'XBRI', lonas: '91H',
    serie: '2410210281', dot: 'KT0V 0M50 4221', km: '12.000'
  },
  veiculo: { marca: 'FIAT', modelo: 'ARGO', versao: 'DRIVE', ano: '2022', placa: 'ABC-1D23', blindado: 'nao', eletrico: 'nao' },
  uso: { estrada: 'asfaltada', posicao: ['dianteiro', 'traseiro'], servico: 'passeio' },
  defeito: 'Pneu apresentou bolha na lateral com pouca rodagem, sem impacto.',
  danos: { materiais: 'nao', vitimas: 'nao' },
  sulco: { original: 8, encontrada: 6.5 }
};

// mapa esperado célula -> valor (p/ conferência)
const expect = {
  T8: 'FLRS DISTRIBUIDORA DE PNEUS - PNEUTOP', F9: 'Fazenda Taquaral', Z9: '19.801-140',
  F10: 'Assis', U10: 'SP', AA10: '99872', E11: '14.465.970/0001-77', V11: '189.097.445.112',
  G12: '094572', S12: '1', AA12: '17/07/2026',
  G4: 'João Paulo', F5: 'Rua das Flores', F6: 'Assis', M6: '19800-000', R6: 'SP', F7: '99999', M7: 'joao@teste.com',
  W4: 'Auto Center XYZ', V6: 'Marília', AH6: 'SP', V7: '3333',
  H15: '195/65R15', K15: 'ECOLOGY', N15: 'XBRI', R15: '91H', W15: '2410210281', W16: 'KT0V 0M50 4221', AD15: '12.000',
  E18: 'FIAT', L18: 'ARGO', Q18: 'DRIVE', X18: '2022', AE18: 'ABC-1D23', J19: 'X', Y19: 'X',
  H21: 'X', K22: 'X', O22: 'X', H23: 'X',
  L24: 'Pneu apresentou bolha', N28: 'X', AB28: 'X', D29: 'João Paulo', V29: '12.345.678-9', AC29: '123.456.789-00',
  C48: '8', I48: '6.5'
};

(async () => {
  const out = await fillFap(JSZip, template, data);
  fs.writeFileSync(__dirname + '/FAP_preenchido_teste.xlsx', out);
  const zip = await JSZip.loadAsync(out);
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');

  function cellVal(ref) {
    // inlineStr
    let m = xml.match(new RegExp('<c r="' + ref + '"[^>]*t="inlineStr"[^>]*><is><t[^>]*>([\\s\\S]*?)</t>'));
    if (m) return m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
    // numeric
    m = xml.match(new RegExp('<c r="' + ref + '"[^>]*?>(?:<f>[^<]*</f>)?<v>([^<]*)</v>'));
    if (m) return m[1];
    return null;
  }

  let ok = 0, fail = 0;
  for (const [ref, exp] of Object.entries(expect)) {
    const got = cellVal(ref);
    const pass = got != null && String(got).indexOf(exp) >= 0;
    if (pass) ok++; else { fail++; console.log(`  ❌ ${ref}: esperado conter "${exp}" | veio: ${JSON.stringify(got)}`); }
  }
  console.log(`\n${ok} OK, ${fail} falhas de ${ok + fail} células conferidas.`);
  // valida XML bem-formado (sem tags <c> quebradas)
  const brokenC = (xml.match(/<c r="[^"]*"[^>]*\/>\s*t="inlineStr"/g) || []).length;
  console.log('tags quebradas:', brokenC);
  console.log('arquivo gerado:', (out.length/1024).toFixed(1), 'KB ->', __dirname + '/FAP_preenchido_teste.xlsx');
})();
