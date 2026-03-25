const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma } = require("../app/config/prisma");

test("generated Prisma client exposes the agent admin delegates", async () => {
  assert.equal(typeof prisma.agentDefinition?.findMany, "function");
  assert.equal(typeof prisma.promptConfig?.findMany, "function");

  await prisma.$disconnect();
});
