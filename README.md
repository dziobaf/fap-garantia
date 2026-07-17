# FAP Garantia — Pneuweb

App que o cliente preenche para abrir garantia de pneu. Ele monta o **FAP
(formulário oficial do fabricante) preenchido**, junta as fotos/vídeo e cria
um **rascunho de e-mail pronto** para a Pneuweb enviar ao fabricante.

## Como funciona
1. Cliente abre o link no celular, escolhe o fabricante e preenche os dados
   (Filas A, C, D, E, F, G, H do FAP). A Fila B (Importador/Distribuidor) já
   vem preenchida com os dados da Pneuweb.
2. Cliente envia as fotos guiadas (DOT/série, banda, defeito, sulco, etc.) + vídeo.
3. Ao enviar, o app gera o `FAP_preenchido.xlsx` **no próprio navegador**
   (edita só o `sheet1.xml`, preservando 100% a formatação/logo do fabricante)
   e manda tudo para o backend.
4. O backend (Google Apps Script) salva no Drive e cria um **rascunho no Gmail**
   da Pneuweb, com o FAP + fotos anexados e o resumo do caso — é só revisar e enviar.

Se o backend não estiver configurado (ou a rede falhar), o app cai num fallback:
gera o FAP pra baixar e abre o WhatsApp da Pneuweb.

## Arquivos
- `index.html`, `style.css`, `app.js` — o app (frontend).
- `config.js` — **onde você cola a URL do backend** e configura marcas/e-mails.
- `fap-fill.js` — preenchimento do FAP (célula a célula). Mapa de células no topo.
- `FAP_sunset.xlsx` — template original do FAP da Sunset.
- `backend/Code.gs` — backend Apps Script (instruções de deploy dentro do arquivo).

## Deploy do backend (1 vez)
Veja o passo a passo no comentário no topo de `backend/Code.gs`. Resumo:
1. script.google.com → novo projeto → cole o `Code.gs`.
2. Implantar como App da Web (executar como você, acesso "qualquer pessoa").
3. Copie a URL `/exec` e cole em `config.js` → `BACKEND_URL`.

## Adicionar outra marca (multimarca)
Em `config.js`, dentro de `MARCAS`, adicione um bloco com o `template` (novo
`.xlsx` do fabricante commitado no repo), `emailFabricante` e `marcasPneu`.
Se o layout do FAP dessa marca for diferente, ajuste o mapa de células em
`fap-fill.js` (ou criamos um mapa por marca).

## Mapa de células (FAP Sunset)
Fila B (importador, fixo): T8 nome · F9 endereço · Z9 CEP · F10 cidade · U10 UF · AA10 fone · E11 CNPJ · V11 IE.
NF venda: G12 nº · S12 série · AA12 data.
Fila A consumidor: G4 nome · F5 end · F6 cidade · M6 CEP · R6 UF · F7 tel · M7 email.
Fila A revendedor: W4 nome · V5 end · V6 cidade · AC6 CEP · AH6 UF · V7 tel · AC7 email.
Fila C pneu: H15 medida · K15 modelo · N15 marca · R15 lonas · W15 série · W16 DOT · AD15 KM.
Fila D veículo: E18 marca · L18 modelo · Q18 versão · X18 ano · AE18 placa · F19/J19 blindado · V19/Y19 elétrico.
Fila E uso: H21/L21/Q21/W21 estrada · K22/O22/T22/X22/AB22/AE22/AH22 posição · H23…AC23 serviço.
Fila F: L24 defeito. Fila G: K28/N28 danos · X28/AB28 vítimas · D29 nome · V29 RG · AC29 CPF.
Fila H: C48 sulco original · I48 sulco encontrado.
