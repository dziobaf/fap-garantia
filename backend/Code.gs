/**
 * FAP Garantia — Backend (Google Apps Script)
 * -------------------------------------------------------------
 * Recebe do app (site) os dados + FAP preenchido + fotos + vídeo,
 * salva tudo no Drive e cria um RASCUNHO no Gmail para o fabricante.
 *
 * >>> DEPLOY (fazer 1 vez, logado na conta Gmail da Pneuweb) <<<
 *  1. https://script.google.com  ->  Novo projeto
 *  2. Cole este arquivo em Code.gs (apague o conteúdo padrão).
 *  3. Ajuste o CONFIG abaixo se quiser.
 *  4. Implantar > Nova implantação > Tipo: "App da Web"
 *       - Executar como: Eu (a conta da Pneuweb)
 *       - Quem pode acessar: "Qualquer pessoa"
 *  5. Copie a URL /exec e cole em config.js do site (BACKEND_URL).
 *  6. Na 1ª execução ele pede autorização do Drive/Gmail — autorize.
 * -------------------------------------------------------------
 */

var CONFIG = {
  PASTA_RAIZ: 'FAP Garantias',            // pasta no Drive onde os casos são guardados
  ASSUNTO_PREFIXO: 'Solicitação de Garantia',
  CC: '',                                  // ex: 'garantia@pneuweb.com.br' (cópia interna)
  LIMITE_ANEXO_MB: 20                      // acima disso, fotos ficam só no Drive (link)
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

    // ---- Rascunho no Gmail ----
    var assunto = CONFIG.ASSUNTO_PREFIXO + ' — ' +
      (d.produto ? (d.produto.marca || '') + ' ' + (d.produto.medida || '') : '') +
      ' — ' + (d.consumidor ? d.consumidor.nome : '');

    var corpo = montarCorpo_(body, d, pasta.getUrl(), videoLink, fotosSoDrive);
    var opts = { attachments: anexos, name: 'Garantias Pneuweb' };
    if (CONFIG.CC) opts.cc = CONFIG.CC;
    var draft = GmailApp.createDraft(body.emailFabricante || '', assunto, corpo, opts);

    return json_({ ok: true, folderUrl: pasta.getUrl(), draftId: draft.getId(), fotosSoDrive: fotosSoDrive });
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
  L.push('Pneuweb / Distribuidora Pneutop');
  return L.join('\n');
}

function pastaPorNome_(nome, pai) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Teste rápido no navegador (abrir a URL /exec) — confirma que está no ar.
function doGet() {
  return ContentService.createTextOutput('FAP Garantia backend no ar ✅ — use POST pelo app.')
    .setMimeType(ContentService.MimeType.TEXT);
}
