/**
 * FAP Garantia — Backend (Google Apps Script)
 * -------------------------------------------------------------
 * Recebe do app (site) os dados + FAP preenchido + fotos + vídeo,
 * salva tudo no Drive e cria um RASCUNHO no Gmail para o fabricante.
 *
 * >>> DEPLOY (fazer 1 vez, LOGADO NA CONTA DO SEU E-MAIL flavio.dzioba@pneuweb.com.br) <<<
 *  Ao enviar o app, este script DISPARA o e-mail (com FAP + fotos) direto do seu
 *  endereço para o fornecedor. A conta que roda o script precisa ser a dona de
 *  flavio.dzioba@pneuweb.com.br OU ter esse endereço em "Enviar como" no Gmail.
 *  1. https://script.google.com  ->  Novo projeto
 *  2. Cole este arquivo em Code.gs (apague o conteúdo padrão).
 *  3. Ajuste o CONFIG abaixo se quiser.
 *  4. Implantar > Nova implantação > Tipo: "App da Web"
 *       - Executar como: Eu (sua conta)
 *       - Quem pode acessar: "Qualquer pessoa"
 *  5. Copie a URL /exec e cole em config.js do site (BACKEND_URL).
 *  6. Na 1ª execução ele pede autorização do Drive/Gmail — autorize.
 * -------------------------------------------------------------
 */

var CONFIG = {
  PASTA_RAIZ: 'FAP Garantias',                 // pasta no Drive onde os casos são guardados
  ASSUNTO_PREFIXO: 'Solicitação de Garantia',
  FROM: 'flavio.dzioba@pneuweb.com.br',        // remetente do rascunho (precisa ser a conta que roda o
                                               // script OU um alias "Enviar como" dela no Gmail)
  CC: 'flavio.dzioba@pneuweb.com.br, contato@pneuweb.com.br', // cópia interna (em todos os e-mails)
  MODO_RASCUNHO: false,                        // false = ENVIA direto; true = só cria rascunho (p/ testar)
  LIMITE_ANEXO_MB: 15                          // total de anexos; acima disso as fotos ficam na pasta pública (link)
};

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var d = body.data || {};
    var stamp = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM-dd HH.mm');
    var nomeCaso = (d.consumidor && d.consumidor.nome ? d.consumidor.nome : 'cliente') +
                   ' - ' + (d.produto && d.produto.medida ? d.produto.medida : 'pneu') + ' - ' + stamp;

    // ---- Pasta do caso no Drive ----
    var raiz = pastaPorNome_(CONFIG.PASTA_RAIZ, DriveApp.getRootFolder());
    var pasta = raiz.createFolder(nomeCaso);
    // pasta pública por link: qualquer link (fotos/vídeo/pasta) abre SEM pedir autorização
    try { pasta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

    var anexos = [];         // p/ o rascunho
    var somaBytes = 0;
    var limite = CONFIG.LIMITE_ANEXO_MB * 1048576;
    var fotosSoDrive = 0;

    // ---- FAP preenchido ----
    var fapBlob = Utilities.newBlob(
      Utilities.base64Decode(body.fap.base64),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body.fap.name || 'FAP.xlsx');
    pasta.createFile(fapBlob);
    anexos.push(fapBlob);
    somaBytes += fapBlob.getBytes().length;

    // ---- Fotos ----
    (body.fotos || []).forEach(function (f, i) {
      var blob = Utilities.newBlob(Utilities.base64Decode(f.base64), 'image/jpeg', f.name || ('foto_' + (i + 1) + '.jpg'));
      pasta.createFile(blob);
      if (somaBytes + blob.getBytes().length < limite) { anexos.push(blob); somaBytes += blob.getBytes().length; }
      else fotosSoDrive++;
    });

    // ---- Vídeo (só Drive, link no corpo) ----
    var videoLink = '';
    if (body.video && body.video.base64) {
      var vblob = Utilities.newBlob(Utilities.base64Decode(body.video.base64), body.video.mime || 'video/mp4', body.video.name || 'video.mp4');
      var vfile = pasta.createFile(vblob);
      vfile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      videoLink = vfile.getUrl();
    }

    // ---- E-mail pro fornecedor ----
    // código do caso: usado depois p/ casar a RESPOSTA do fornecedor com este cliente
    var code = Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase();
    if (d.consumidor && d.consumidor.email) {
      PropertiesService.getScriptProperties().setProperty('case_' + code, JSON.stringify({
        email: d.consumidor.email,
        nome: (d.consumidor.nome || ''),
        produto: (((d.produto && d.produto.marca) || '') + ' ' + ((d.produto && d.produto.medida) || '')).trim()
      }));
    }

    var assunto = CONFIG.ASSUNTO_PREFIXO + ' — ' +
      (d.produto ? (d.produto.marca || '') + ' ' + (d.produto.medida || '') : '') +
      ' — ' + (d.consumidor ? d.consumidor.nome : '') + ' [G-' + code + ']';

    var corpo = montarCorpo_(body, d, pasta.getUrl(), videoLink, fotosSoDrive);
    var opts = { attachments: anexos, name: 'Garantias PneuTop' };
    if (CONFIG.CC) opts.cc = CONFIG.CC;
    var from = podeFrom_(); if (from) opts.from = from;   // remetente = seu e-mail

    var destino = body.emailFabricante || '';
    if (CONFIG.MODO_RASCUNHO) {
      // (opcional) cria rascunho em vez de enviar — deixe CONFIG.MODO_RASCUNHO=true p/ testar sem disparar
      var draft = GmailApp.createDraft(destino, assunto, corpo, opts);
      return json_({ ok: true, enviado: false, rascunho: true, folderUrl: pasta.getUrl(), draftId: draft.getId(), fotosSoDrive: fotosSoDrive });
    }
    // ENVIA direto do seu e-mail para o fornecedor
    GmailApp.sendEmail(destino, assunto, corpo, opts);
    return json_({ ok: true, enviado: true, destino: destino, folderUrl: pasta.getUrl(), fotosSoDrive: fotosSoDrive });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function montarCorpo_(body, d, folderUrl, videoLink, fotosSoDrive) {
  var L = [];
  L.push('Prezados,');
  L.push('');
  L.push('Encaminhamos solicitação de análise de garantia. Formulário FAP preenchido (Excel) em anexo, junto com as fotos do produto.');
  L.push('');
  L.push(body.resumoTexto || '');
  L.push('');
  if (videoLink) L.push('Vídeo do pneu: ' + videoLink);
  if (fotosSoDrive > 0) L.push('Obs.: ' + fotosSoDrive + ' foto(s) adicional(is) disponível(is) na pasta: ' + folderUrl);
  L.push('Pasta com todos os arquivos: ' + folderUrl);
  L.push('');
  L.push('Atenciosamente,');
  L.push('Distribuidora PneuTop');
  return L.join('\n');
}

function pastaPorNome_(nome, pai) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// remetente permitido (conta atual ou alias "Enviar como")
function podeFrom_() {
  if (!CONFIG.FROM) return null;
  try {
    var aliases = GmailApp.getAliases();
    if (CONFIG.FROM === Session.getActiveUser().getEmail() || aliases.indexOf(CONFIG.FROM) >= 0) return CONFIG.FROM;
  } catch (e) {}
  return null;
}

function pegarLabel_(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}

/**
 * Gatilho (roda a cada 15 min): acha respostas do fornecedor aos casos e
 * monta um RASCUNHO pro e-mail do cliente com o retorno. Não envia — você revisa.
 * (Pra deixar 100% automático depois: troque createDraft por sendEmail abaixo.)
 */
function verificarRespostasFornecedor() {
  var meu = Session.getActiveUser().getEmail();
  var label = pegarLabel_('fap-respondido');
  var threads = GmailApp.search('subject:"[G-" -label:fap-respondido newer_than:180d');
  threads.forEach(function (th) {
    var msgs = th.getMessages();
    var last = msgs[msgs.length - 1];
    var fromLast = last.getFrom() || '';
    // se a última mensagem foi enviada por nós, ainda não houve resposta do fornecedor
    if (fromLast.indexOf(meu) >= 0 || (CONFIG.FROM && fromLast.indexOf(CONFIG.FROM) >= 0)) return;

    var m = (th.getFirstMessageSubject() || '').match(/\[G-([A-Za-z0-9]+)\]/);
    if (!m) return;
    var raw = PropertiesService.getScriptProperties().getProperty('case_' + m[1]);
    if (!raw) return;
    var caso = JSON.parse(raw);
    if (!caso.email) { th.addLabel(label); return; }

    var assunto = 'Retorno da garantia do seu pneu' + (caso.produto ? ' — ' + caso.produto : '');
    var opts = { name: 'Garantias PneuTop' };
    if (CONFIG.CC) opts.cc = CONFIG.CC;
    try { var att = last.getAttachments(); if (att && att.length) opts.attachments = att; } catch (e) {}
    var from = podeFrom_(); if (from) opts.from = from;

    // MODO RASCUNHO (revisão): cria rascunho pro cliente. Depois é só clicar enviar.
    GmailApp.createDraft(caso.email, assunto, montarCorpoCliente_(caso, last), opts);
    // Pra 100% automático no futuro, comente a linha acima e use:
    // GmailApp.sendEmail(caso.email, assunto, montarCorpoCliente_(caso, last), opts);

    th.addLabel(label);
  });
}

function montarCorpoCliente_(caso, msgFornecedor) {
  var L = [];
  L.push('Olá ' + (caso.nome ? caso.nome.split(' ')[0] : '') + ',');
  L.push('');
  L.push('Recebemos o retorno da análise de garantia do seu pneu' + (caso.produto ? ' (' + caso.produto + ')' : '') + '. Segue abaixo o resultado informado pelo fabricante:');
  L.push('');
  L.push('----------------------------------------');
  try { L.push((msgFornecedor.getPlainBody() || '').trim()); } catch (e) {}
  L.push('----------------------------------------');
  L.push('');
  L.push('Qualquer dúvida, estamos à disposição.');
  L.push('Distribuidora PneuTop');
  return L.join('\n');
}

// Rode UMA VEZ no editor (botão Executar) para autorizar tudo e ativar o gatilho de respostas.
function configurar() {
  DriveApp.getRootFolder();
  GmailApp.getAliases();
  pegarLabel_('fap-respondido');
  var jah = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'verificarRespostasFornecedor'; });
  if (!jah) ScriptApp.newTrigger('verificarRespostasFornecedor').timeBased().everyMinutes(15).create();
  Logger.log('Configurado. Gatilho de respostas ativo (a cada 15 min). Conta: ' + Session.getActiveUser().getEmail());
}

// Rode UMA VEZ no editor (botão Executar) para autorizar Gmail + Drive.
function autorizar() {
  DriveApp.getRootFolder();
  GmailApp.getAliases();
  Logger.log('Autorizado como: ' + Session.getActiveUser().getEmail());
}

// Teste rápido no navegador (abrir a URL /exec) — confirma que está no ar.
function doGet() {
  return ContentService.createTextOutput('FAP Garantia backend no ar ✅ — use POST pelo app.')
    .setMimeType(ContentService.MimeType.TEXT);
}
