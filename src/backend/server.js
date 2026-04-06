const { createApp } = require("./app/create-app");
const { env } = require("./app/config/env");
const { prisma } = require("./app/config/prisma");

const app = createApp({ prisma });
const knowledgeBaseRuntime = app.locals.knowledgeBaseRuntime;
const prospectingRuntime = app.locals.prospectingRuntime;

knowledgeBaseRuntime?.start?.().catch((error) => {
  process.stderr.write(`Knowledge base runtime failed to start: ${error.message}\n`);
});
prospectingRuntime?.start?.().catch((error) => {
  process.stderr.write(`Prospecting runtime failed to start: ${error.message}\n`);
});

const server = app.listen(env.port, env.host, () => {
  process.stdout.write(
    `HelmOS backend listening on http://${env.host}:${env.port}\n`,
  );
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  process.stdout.write(`Received ${signal}, shutting down backend\n`);

  server.close(async () => {
    await knowledgeBaseRuntime?.stop?.();
    await prospectingRuntime?.stop?.();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    process.stderr.write(`Shutdown failed: ${error.message}\n`);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    process.stderr.write(`Shutdown failed: ${error.message}\n`);
    process.exit(1);
  });
});
