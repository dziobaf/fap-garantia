const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://dziobaf.github.io/fap-garantia/';
const JPG = path.join(__dirname, 'foto_teste.jpg');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  // permitir download p/ blob (não precisamos salvar, só confirmar link)
  await page.goto(URL, { waitUntil: 'networkidle2' });

  const step = async name => page.waitForSelector(`[data-step="${name}"]:not(.hidden)`, { timeout: 8000 });
  const click = async sel => { await page.click(sel); };
  const type = async (sel, v) => { await page.type(sel, v); };

  await step('intro');
  await click('[data-step="intro"] [data-next]');

  await step('consumidor');
  await type('#c_nome', 'João Paulo da Silva');
  await type('#c_telefone', '18999990000');
  await type('#c_cidade', 'Assis'); await type('#c_uf', 'SP');
  await click('[data-step="consumidor"] [data-next]');

  await step('produto');
  const marcas = await page.$$eval('#p_marca option', els => els.map(e => e.value));
  await type('#p_medida', '195/65R15');
  await type('#p_dot', 'KT0V 0M50 4221');
  await type('#p_serie', '2410210281');
  // abre as fotos-ajuda e tira print
  await page.$$eval('[data-step="produto"] details.ajuda', ds => ds.forEach(d => d.open = true));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'shot_produto.png'), fullPage: true });
  console.log('marcas do pneu:', JSON.stringify(marcas));
  await click('[data-step="produto"] [data-next]');

  await step('veiculo');
  await type('#v_marca', 'FIAT'); await type('#v_modelo', 'ARGO');
  await page.click('#u_estrada input[value="asfaltada"]');
  await page.click('#u_posicao input[value="dianteiro"]');
  await page.click('#u_servico input[value="passeio"]');
  await click('[data-step="veiculo"] [data-next]');

  await step('defeito');
  await type('#d_defeito', 'Bolha na lateral com pouca rodagem, sem impacto.');
  await type('#s_encontrada', '6,5');
  await click('[data-step="defeito"] [data-next]');

  await step('fotos');
  // sobe 1 foto em cada grupo obrigatório
  const reqGroups = ['ident_medida', 'ident_dot', 'banda', 'defeito', 'inteiro', 'sulco'];
  for (const g of reqGroups) {
    const input = await page.$(`#grp_${g} input[type=file]`);
    await input.uploadFile(JPG);
    await new Promise(r => setTimeout(r, 250)); // deixa o resize/canvas rodar
  }
  // confere thumbs renderizados
  const thumbs = await page.$$eval('.thumb', els => els.length);
  await click('[data-step="fotos"] [data-next]');

  await step('revisar');
  const resumo = await page.$eval('#resumo', el => el.innerText);
  await page.click('#aceite');
  await click('#enviar');

  // sem backend -> fallback: passo "fim" com link de download
  await step('fim');
  const fimMsg = await page.$eval('#fim-msg', el => el.innerText);
  const links = await page.$$eval('#fim-extra a, .linkbtn', els => els.map(e => e.textContent));

  console.log('--- RESULTADO E2E ---');
  console.log('thumbs renderizados:', thumbs, '(esperado >= 6)');
  console.log('resumo contém pneu?', /195\/65R15/.test(resumo));
  console.log('chegou no FIM:', !!fimMsg);
  console.log('links no fim:', JSON.stringify(links));
  console.log('erros de console:', errs.length ? errs : 'nenhum');

  await browser.close();
  const ok = thumbs >= 6 && /195\/65R15/.test(resumo) && fimMsg && links.some(l => /Baixar/.test(l)) && errs.length === 0;
  console.log(ok ? '\n✅ E2E PASSOU' : '\n❌ E2E FALHOU');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ERRO:', e.message); process.exit(2); });
