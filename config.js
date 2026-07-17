/*
 * config.js — configuração por marca (multimarca) + endpoint do backend.
 *
 * >>> DEPOIS DE PUBLICAR O BACKEND (Apps Script), cole a URL /exec aqui: <<<
 */
window.FAP_CONFIG = {
  // URL do Web App do Apps Script (…/exec). Enquanto vazio, o app gera o
  // arquivo e as fotos pra baixar, sem enviar automático.
  BACKEND_URL: '',

  // Marcas suportadas. Cada uma tem seu template de FAP e e-mail do fabricante.
  // Só a Sunset está ativa; as outras entram quando o Flávio passar FAP + e-mail.
  MARCAS: {
    sunset: {
      nome: 'Sunset',
      ativo: true,
      template: 'FAP_sunset.xlsx',
      emailFabricante: 'garantia@sunset-pneus.com.br',
      // marcas comerciais cobertas por esse FAP (aparecem no seletor de marca do pneu)
      marcasPneu: ['XBRI', 'Sunset', 'Servis', 'Outra']
    }
    // exemplo p/ adicionar depois:
    // xbri: { nome:'XBRI', ativo:true, template:'FAP_xbri.xlsx', emailFabricante:'...', marcasPneu:['XBRI'] }
  },

  // Dados de contato da Pneuweb (mostrados ao cliente / usados no fallback WhatsApp)
  PNEUWEB: {
    empresa: 'Pneuweb / Distribuidora Pneutop',
    whatsapp: '5518998728650',
    email: 'garantia@pneuweb.com.br'
  }
};
