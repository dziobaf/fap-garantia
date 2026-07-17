/*
 * config.js — configuração por marca (multimarca) + endpoint do backend.
 *
 * >>> DEPOIS DE PUBLICAR O BACKEND (Apps Script), cole a URL /exec aqui: <<<
 */
window.FAP_CONFIG = {
  // URL do Web App do Apps Script (…/exec). Enquanto vazio, o app gera o
  // arquivo e as fotos pra baixar, sem enviar automático.
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbym1j1hz2C3I6rgfmTI59x8syZIfwAooWNaeN9ZppKpQcW9rWxfHlYfnYLlHCOeqa3EQg/exec',

  // Marcas suportadas. Cada uma tem seu template de FAP e e-mail do fabricante.
  // Só a Sunset está ativa; as outras entram quando o Flávio passar FAP + e-mail.
  MARCAS: {
    sunset: {
      nome: 'Sunset',
      ativo: true,
      template: 'FAP_sunset.xlsx',
      emailFabricante: 'dziobaf@gmail.com', // TESTE — reverter p/ garantia@sunset-pneus.com.br
      // marcas comerciais cobertas por esse FAP (aparecem no seletor de marca do pneu)
      marcasPneu: ['XBRI', 'Linglong', 'Autogreen', 'Trackmaxx', 'Landspider', 'Aderenza', 'Durable', 'Duraturn', 'Outra']
    }
    // exemplo p/ adicionar depois:
    // xbri: { nome:'XBRI', ativo:true, template:'FAP_xbri.xlsx', emailFabricante:'...', marcasPneu:['XBRI'] }
  },

  // Dados de contato da Pneuweb (mostrados ao cliente / usados no fallback WhatsApp)
  PNEUWEB: {
    empresa: 'Distribuidora PneuTop',
    whatsapp: '5511998728650',
    email: 'flavio.dzioba@pneuweb.com.br'
  }
};
