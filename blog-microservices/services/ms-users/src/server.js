// src/server.js
// -----------------------------------------------------------------------------
// Ponto de entrada do ms-users: é o ÚNICO arquivo que abre uma porta HTTP.
//
// Fluxo:
//   1. lê a configuração do ambiente;
//   2. monta o servidor (banco, services, app);
//   3. sobe o HTTP e registra o encerramento limpo ao receber sinais do sistema.
// -----------------------------------------------------------------------------

import { loadConfig } from './config.js';
import { buildServer } from './container.js';

const config = loadConfig();
const { app, db } = buildServer(config);

// No Express 5, o callback de listen recebe um erro quando a porta não pode
// ser aberta (ex.: EADDRINUSE). Sem esta verificação, o processo mostraria
// "ouvindo" e encerraria em silêncio.
const server = app.listen(config.port, (error) => {
  if (error) {
    console.error(`[ms-users] não foi possível abrir a porta ${config.port}: ${error.message}`);
    db.close();
    process.exit(1);
  }
  console.log(`[ms-users] ouvindo na porta ${config.port} (ambiente: ${config.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`[ms-users] ${signal} recebido, encerrando...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
