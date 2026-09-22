'use strict';

const app = require('../server');
const backend = require('../backend/src');

async function main() {
  await backend.connectDatabase();

  const port = Number(process.env.PORT || 5003);
  const host = '127.0.0.1';

  const server = app.listen(port, host, () => {
    console.log(`🚀 MyZubster Gateway listening on ${host}:${port}`);
    console.log('✅ Backend MongoDB initialized');
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal}: shutting down MyZubster Gateway`);

    server.close(async () => {
      try {
        await backend.disconnectDatabase();
      } catch (error) {
        console.error('Backend MongoDB shutdown error:', error);
      }

      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start MyZubster Gateway:', error);
  process.exit(1);
});
