// src/server.js
// -----------------------------------------------------------------------------
// Ponto de entrada do ms-blog: o único arquivo que abre uma porta HTTP.
//
// Fluxo: lê a configuração → monta o servidor → abre a porta e trata o
// encerramento limpo. O mesmo padrão do ms-users.
// -----------------------------------------------------------------------------

import { loadConfig } from './config.js';
import { buildServer } from './container.js';

const config = loadConfig();
const { app, db } = buildServer(config);

// No Express 5, o callback de listen recebe um erro quando a porta não pode
// ser aberta. Sem esta verificação, o processo mostraria "ouvindo" e sairia em silêncio.
const server = app.listen(config.port, (error) => {
  if (error) {
    console.error(`[ms-blog] não foi possível abrir a porta ${config.port}: ${error.message}`);
    db.close();
    process.exit(1);
  }
  console.log(
    `[ms-blog] ouvindo na porta ${config.port} (ambiente: ${config.nodeEnv}, ms-users: ${config.usersService.baseUrl})`,
  );
});

function shutdown(signal) {
  console.log(`[ms-blog] ${signal} recebido, encerrando...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
