/* app.js — Solicitação de garantia de pneu (Pneuweb) */
(function () {
  'use strict';
  var CFG = window.FAP_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- Grupos de fotos exigidos (guia da Sunset) ----------
  var GRUPOS = [
    { id: 'ident_medida', titulo: 'Medida, marca e modelo', desc: 'Foto da lateral mostrando a medida, a marca e o modelo do pneu.', req: true },
    { id: 'ident_dot', titulo: 'DOT / Série', desc: 'Foto nítida do DOT e do número de série (matrícula/código de barras).', req: true },
    { id: 'banda', titulo: 'Banda de rodagem', desc: 'Fotos da banda em partes diferentes do pneu.', req: true, multi: true },
    { id: 'defeito', titulo: 'O defeito', desc: 'Foto do defeito, de preferência marcado com giz.', req: true, multi: true },
    { id: 'inteiro', titulo: 'Pneu inteiro', desc: 'Foto do pneu inteiro, de um lado.', req: true },
    { id: 'sulco', titulo: 'Medição do sulco', desc: 'Paquímetro/régua sobre a banda mostrando a profundidade em mm.', req: true },
    { id: 'talao', titulo: 'Talão', desc: 'Fotos do talão do pneu.', req: false, multi: true },
    { id: 'interior', titulo: 'Interior / paredes laterais', desc: 'Fotos do interior em ângulos diferentes, principalmente as paredes laterais.', req: false, multi: true },
    { id: 'flanco', titulo: 'Flanco / ombro', desc: 'Fotos do flanco e do ombro do pneu.', req: false, multi: true },
    { id: 'bolha', titulo: 'Se for bolha: pneu montado e cheio', desc: 'Se o defeito é bolha, foto do pneu montado e inflado ANTES de desmontar.', req: false, multi: true }
  ];

  var STEPS = ['intro', 'consumidor', 'produto', 'veiculo', 'defeito', 'fotos', 'revisar', 'fim'];
  var stepIdx = 0;
  var fotos = {};      // { grupoId: [ {name, dataUrl} ] }
  var videoData = null; // { name, mime, base64, sizeMB } | null

  // ---------- Init ----------
  function init() {
    // marcas (fabricantes)
    var selMarca = $('#marca');
    Object.keys(CFG.MARCAS).forEach(function (k) {
      var m = CFG.MARCAS[k];
      if (!m.ativo) return;
      var o = document.createElement('option'); o.value = k; o.textContent = m.nome;
      selMarca.appendChild(o);
    });
    selMarca.addEventListener('change', popularMarcasPneu);
    popularMarcasPneu();
    renderGrupos();

    $$('[data-next]').forEach(function (b) { b.addEventListener('click', next); });
    $$('[data-prev]').forEach(function (b) { b.addEventListener('click', prev); });
    $('#aceite').addEventListener('change', function () { $('#enviar').disabled = !this.checked; });
    $('#enviar').addEventListener('click', enviar);
    $('#video').addEventListener('change', onVideo);
    showStep(0);
  }

  function popularMarcasPneu() {
    var m = CFG.MARCAS[$('#marca').value];
    var sel = $('#p_marca'); sel.innerHTML = '';
    (m.marcasPneu || ['Outra']).forEach(function (mp) {
      var o = document.createElement('option'); o.value = mp; o.textContent = mp; sel.appendChild(o);
    });
  }

  // ---------- Navegação ----------
  function showStep(i) {
    stepIdx = i;
    $$('.step').forEach(function (s) { s.classList.add('hidden'); });
    $('[data-step="' + STEPS[i] + '"]').classList.remove('hidden');
    $('#progress-bar').style.width = Math.round((i / (STEPS.length - 1)) * 100) + '%';
    window.scrollTo(0, 0);
    if (STEPS[i] === 'revisar') buildResumo();
  }
  function next() { if (validate(STEPS[stepIdx])) showStep(Math.min(stepIdx + 1, STEPS.length - 1)); }
  function prev() { showStep(Math.max(stepIdx - 1, 0)); }

  function validate(step) {
    clearErrors();
    var faltando = [];
    if (step === 'consumidor') {
      if (!$('#c_nome').value.trim()) faltando.push(['#c_nome', 'Informe seu nome']);
      if (!$('#c_telefone').value.trim()) faltando.push(['#c_telefone', 'Informe um telefone']);
    }
    if (step === 'produto') {
      if (!$('#p_medida').value.trim()) faltando.push(['#p_medida', 'Informe a medida']);
      if (!$('#p_dot').value.trim()) faltando.push(['#p_dot', 'Informe o DOT']);
    }
    if (step === 'defeito') {
      if (!$('#d_defeito').value.trim()) faltando.push(['#d_defeito', 'Descreva o defeito']);
    }
    if (step === 'fotos') {
      GRUPOS.forEach(function (g) {
        if (g.req && (!fotos[g.id] || !fotos[g.id].length)) faltando.push(['#grp_' + g.id, 'Foto obrigatória: ' + g.titulo]);
      });
    }
    if (faltando.length) {
      faltando.forEach(function (f) {
        var el = $(f[0]); if (!el) return;
        var e = document.createElement('div'); e.className = 'err'; e.textContent = f[1];
        (el.closest('.field') || el).appendChild(e);
      });
      var first = $(faltando[0][0]); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }
  function clearErrors() { $$('.err').forEach(function (e) { e.remove(); }); }

  // ---------- Fotos ----------
  function renderGrupos() {
    var wrap = $('#foto-grupos'); wrap.innerHTML = '';
    GRUPOS.forEach(function (g) {
      var div = document.createElement('div');
      div.className = 'foto-grupo'; div.id = 'grp_' + g.id;
      div.innerHTML =
        '<div class="fg-head"><div class="fg-title">' + g.titulo +
        (g.req ? ' <span class="req">*</span>' : '') + '</div>' +
        '<button type="button" class="fg-add">+ Foto</button></div>' +
        '<div class="fg-desc">' + g.desc + '</div>' +
        '<div class="thumbs"></div>' +
        '<input type="file" accept="image/*" capture="environment" ' + (g.multi ? 'multiple' : '') + ' hidden>';
      wrap.appendChild(div);
      var input = $('input[type=file]', div);
      $('.fg-add', div).addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () { addFotos(g, input.files, div); input.value = ''; });
    });
  }

  function addFotos(g, files, div) {
    fotos[g.id] = fotos[g.id] || [];
    var arr = Array.prototype.slice.call(files);
    var i = 0;
    (function nextFile() {
      if (i >= arr.length) return;
      resizeImage(arr[i], function (dataUrl) {
        fotos[g.id].push({ name: (g.id + '_' + (fotos[g.id].length + 1) + '.jpg'), dataUrl: dataUrl });
        renderThumbs(g, div); i++; nextFile();
      });
    })();
  }

  function renderThumbs(g, div) {
    var t = $('.thumbs', div); t.innerHTML = '';
    (fotos[g.id] || []).forEach(function (f, idx) {
      var el = document.createElement('div'); el.className = 'thumb';
      el.innerHTML = '<img src="' + f.dataUrl + '"><button type="button">×</button>';
      $('button', el).addEventListener('click', function () { fotos[g.id].splice(idx, 1); renderThumbs(g, div); });
      t.appendChild(el);
    });
    div.classList.toggle('tem', (fotos[g.id] || []).length > 0);
  }

  function resizeImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > max) { w = Math.round(w * max / h); h = max; }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { cb(e.target.result); }; // fallback: usa original
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function onVideo() {
    var f = this.files[0];
    if (!f) { videoData = null; $('#video-info').textContent = ''; return; }
    var mb = f.size / 1048576;
    var reader = new FileReader();
    reader.onload = function (e) {
      videoData = { name: f.name, mime: f.type || 'video/mp4', base64: e.target.result.split(',')[1], sizeMB: mb };
      $('#video-info').textContent = '🎥 ' + f.name + ' (' + mb.toFixed(1) + ' MB)' +
        (mb > 45 ? ' — grande: se falhar, mande no WhatsApp da loja.' : '');
    };
    reader.readAsDataURL(f);
  }

  // ---------- Montar dados ----------
  function fmtData(iso) { if (!iso) return ''; var p = iso.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function hoje() { var d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }

  function buildData() {
    var posicao = $$('#u_posicao input:checked').map(function (i) { return i.value; });
    var estrada = ($('#u_estrada input:checked') || {}).value;
    var servico = ($('#u_servico input:checked') || {}).value;
    return {
      dataEnvio: hoje(),
      nf: { numero: $('#nf_num').value.trim(), serie: '', data: fmtData($('#nf_data').value) },
      consumidor: {
        nome: $('#c_nome').value.trim(), cpf: $('#c_cpf').value.trim(), rg: $('#c_rg').value.trim(),
        endereco: $('#c_endereco').value.trim(), cidade: $('#c_cidade').value.trim(),
        uf: $('#c_uf').value.trim().toUpperCase(), cep: $('#c_cep').value.trim(),
        telefone: $('#c_telefone').value.trim(), email: $('#c_email').value.trim()
      },
      revendedor: { nome: $('#r_nome').value.trim() },
      produto: {
        medida: $('#p_medida').value.trim(), marca: $('#p_marca').value, modelo: $('#p_modelo').value.trim(),
        lonas: $('#p_lonas').value.trim(), serie: $('#p_serie').value.trim(),
        dot: $('#p_dot').value.trim(), km: $('#p_km').value.trim()
      },
      veiculo: {
        marca: $('#v_marca').value.trim(), modelo: $('#v_modelo').value.trim(), versao: $('#v_versao').value.trim(),
        ano: $('#v_ano').value.trim(), placa: $('#v_placa').value.trim(),
        blindado: $('#v_blindado').value, eletrico: $('#v_eletrico').value
      },
      uso: { estrada: estrada, posicao: posicao, servico: servico },
      defeito: $('#d_defeito').value.trim(),
      danos: { materiais: $('#g_materiais').value, vitimas: $('#g_vitimas').value },
      sulco: { original: $('#s_original').value.trim(), encontrada: $('#s_encontrada').value.trim() }
    };
  }

  function buildResumo() {
    var d = buildData();
    var nFotos = Object.keys(fotos).reduce(function (a, k) { return a + fotos[k].length; }, 0);
    function kv(k, v) { return v ? '<div class="kv"><b>' + k + '</b><span>' + esc(v) + '</span></div>' : ''; }
    var h = '';
    h += '<h3>Solicitante</h3>' + kv('Nome', d.consumidor.nome) + kv('Telefone', d.consumidor.telefone) + kv('E-mail', d.consumidor.email) + kv('Cidade', d.consumidor.cidade + (d.consumidor.uf ? '/' + d.consumidor.uf : ''));
    h += '<h3>Pneu</h3>' + kv('Medida', d.produto.medida) + kv('Marca', d.produto.marca) + kv('Modelo', d.produto.modelo) + kv('Série', d.produto.serie) + kv('DOT', d.produto.dot) + kv('KM', d.produto.km);
    h += '<h3>Defeito</h3>' + kv('Descrição', d.defeito) + kv('Sulco encontrado', d.sulco.encontrada ? d.sulco.encontrada + ' mm' : '');
    h += '<h3>Fotos</h3><div class="kv"><b>Total enviado</b><span>' + nFotos + ' foto(s)' + (videoData ? ' + 1 vídeo' : '') + '</span></div>';
    $('#resumo').innerHTML = h;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---------- Enviar ----------
  function overlay(on, msg) { $('#overlay').classList.toggle('hidden', !on); if (msg) $('#overlay-msg').textContent = msg; }

  function blobToBase64(blob, cb) {
    var r = new FileReader(); r.onload = function () { cb(r.result.split(',')[1]); }; r.readAsDataURL(blob);
  }

  function enviar() {
    var marcaKey = $('#marca').value;
    var marcaCfg = CFG.MARCAS[marcaKey];
    var data = buildData();
    overlay(true, 'Montando o formulário oficial…');

    fetch(marcaCfg.template).then(function (r) { return r.arrayBuffer(); })
      .then(function (tpl) { return window.FapFill.fillFap(window.JSZip, tpl, data); })
      .then(function (fapBlob) {
        blobToBase64(fapBlob, function (fapB64) {
          var fotosPayload = [];
          Object.keys(fotos).forEach(function (gid) {
            fotos[gid].forEach(function (f) { fotosPayload.push({ grupo: gid, name: f.name, base64: f.dataUrl.split(',')[1] }); });
          });
          var payload = {
            marca: marcaKey, emailFabricante: marcaCfg.emailFabricante,
            data: data, resumoTexto: resumoTexto(data, fotosPayload.length),
            fap: { name: nomeArquivoFap(data), base64: fapB64 },
            fotos: fotosPayload, video: videoData
          };
          if (CFG.BACKEND_URL) enviarBackend(payload, fapBlob, data);
          else fallbackDownload(fapBlob, data);
        });
      })
      .catch(function (err) { overlay(false); alert('Erro ao montar o formulário: ' + err.message); });
  }

  function nomeArquivoFap(d) {
    var n = (d.consumidor.nome || 'cliente').split(' ')[0];
    return 'FAP_' + n + '_' + (d.produto.medida || '').replace(/\W+/g, '') + '.xlsx';
  }

  function resumoTexto(d, nFotos) {
    return [
      'Solicitação de garantia — ' + (d.produto.marca || '') + ' ' + (d.produto.medida || ''),
      '',
      'SOLICITANTE: ' + d.consumidor.nome + ' | Tel: ' + d.consumidor.telefone + (d.consumidor.email ? ' | ' + d.consumidor.email : ''),
      'PNEU: ' + d.produto.medida + ' ' + d.produto.marca + ' ' + d.produto.modelo + ' | Série: ' + d.produto.serie + ' | DOT: ' + d.produto.dot + ' | KM: ' + d.produto.km,
      'VEÍCULO: ' + [d.veiculo.marca, d.veiculo.modelo, d.veiculo.ano, d.veiculo.placa].filter(Boolean).join(' '),
      'SULCO ENCONTRADO: ' + (d.sulco.encontrada ? d.sulco.encontrada + ' mm' : '(não informado)'),
      '',
      'DEFEITO RELATADO: ' + d.defeito,
      '',
      'Fotos anexadas: ' + nFotos
    ].join('\n');
  }

  function enviarBackend(payload, fapBlob, data) {
    overlay(true, 'Enviando fotos e dados… não feche a tela.');
    fetch(CFG.BACKEND_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        overlay(false);
        if (res && res.ok) {
          $('#fim-msg').textContent = 'Seus dados chegaram na Pneuweb e o formulário do fabricante já está montado. Nossa equipe vai revisar e dar andamento na garantia. Fica de olho no seu telefone/e-mail!';
        } else {
          $('#fim-msg').textContent = 'Recebemos, mas houve um aviso no processamento. Nossa equipe foi notificada. Se quiser, guarde uma cópia do formulário abaixo.';
          addDownloadLink(fapBlob, data);
        }
        showStep(STEPS.indexOf('fim'));
      })
      .catch(function () {
        // rede falhou — cai pro fallback de download + WhatsApp
        overlay(false); fallbackDownload(fapBlob, data, true);
      });
  }

  function fallbackDownload(fapBlob, data, avisoRede) {
    overlay(false);
    $('#fim-msg').textContent = avisoRede
      ? 'Não consegui enviar automático (conexão). Sem problema: baixe o formulário abaixo e mande junto com as fotos pro nosso WhatsApp.'
      : 'Tudo pronto! Baixe o formulário abaixo e mande junto com as fotos pro nosso WhatsApp que a gente dá andamento.';
    addDownloadLink(fapBlob, data);
    var wa = 'https://wa.me/' + CFG.PNEUWEB.whatsapp + '?text=' + encodeURIComponent('Olá! Segue minha solicitação de garantia do pneu ' + (data.produto.medida || '') + '. Vou enviar o formulário e as fotos.');
    var a = document.createElement('a'); a.href = wa; a.className = 'linkbtn'; a.target = '_blank'; a.textContent = '💬 Abrir WhatsApp da Pneuweb';
    $('#fim-extra').appendChild(a);
    showStep(STEPS.indexOf('fim'));
  }

  function addDownloadLink(fapBlob, data) {
    var url = URL.createObjectURL(fapBlob);
    var a = document.createElement('a'); a.href = url; a.download = nomeArquivoFap(data);
    a.className = 'linkbtn'; a.textContent = '⬇️ Baixar formulário (FAP) preenchido';
    $('#fim-extra').appendChild(a);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
