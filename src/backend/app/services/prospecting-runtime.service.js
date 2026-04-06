const { createLogEntry } = require("./log-entry.service");
const {
  runProspectingOptimizationCycle,
} = require("./prospecting-configuration.service");

const DEFAULT_POLL_MS = 60_000;

function createProspectingRuntime({
  prisma,
  agentGatewayClient,
  config = {},
  runOptimizationCycle = runProspectingOptimizationCycle,
  now = () => new Date(),
  onError = defaultRuntimeErrorReporter,
} = {}) {
  let timer = null;
  let draining = false;
  let schemaReady = true;
  const inFlightConfigurationIds = new Set();

  async function tick() {
    if (draining || !prisma?.prospectingConfiguration || typeof runOptimizationCycle !== "function") {
      return;
    }

    draining = true;
    try {
      const candidateConfigurations = await prisma.prospectingConfiguration.findMany({
        where: {
          agentState: "active",
        },
        include: {
          ownerUser: {
            select: {
              id: true,
              email: true,
              displayName: true,
              appRole: true,
            },
          },
        },
        orderBy: {
          nextRunAt: "asc",
        },
      });
      const dueConfigurations = candidateConfigurations.filter((configuration) =>
        !inFlightConfigurationIds.has(configuration.id) &&
        isProspectingConfigurationDue(configuration, now()),
      );

      for (const configuration of dueConfigurations) {
        const currentUser = configuration.ownerUser;
        if (!currentUser?.id) {
          continue;
        }

        const claimed = await claimProspectingConfigurationRun(prisma, configuration, now());
        if (!claimed) {
          continue;
        }

        await createLogEntry(prisma, {
          level: "info",
          scope: "idea-foundry",
          event: "prospecting_runtime_cycle_started",
          message: "Started a scheduled hourly prospecting cycle.",
          context: {
            userId: currentUser.id,
            configurationId: configuration.id,
            dueAt: configuration.nextRunAt ?? null,
          },
        });

        try {
          inFlightConfigurationIds.add(configuration.id);
          const result = await runOptimizationCycle(
            prisma,
            agentGatewayClient,
            {
              snapshot: configuration.uiSnapshotJson ?? null,
            },
            currentUser,
          );

          await createLogEntry(prisma, {
            level: "info",
            scope: "idea-foundry",
            event: "prospecting_runtime_cycle_succeeded",
            message: "Completed a scheduled hourly prospecting cycle.",
            context: {
              userId: currentUser.id,
              configurationId: configuration.id,
              latestRunStatus: result?.runtime?.latestRunStatus ?? null,
              resultRecordCount: result?.runtime?.resultRecordCount ?? 0,
            },
          });
        } catch (error) {
          await createLogEntry(prisma, {
            level: "error",
            scope: "idea-foundry",
            event: "prospecting_runtime_cycle_failed",
            message: "Scheduled hourly prospecting cycle failed.",
            context: {
              userId: currentUser.id,
              configurationId: configuration.id,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        } finally {
          inFlightConfigurationIds.delete(configuration.id);
        }
      }
    } finally {
      draining = false;
    }
  }

  return {
    async start() {
      if (timer) {
        return;
      }

      timer = setInterval(() => {
        tick().catch((error) => {
          onError(error);
        });
      }, Number.isFinite(config.pollMs) ? config.pollMs : DEFAULT_POLL_MS);

      if (typeof timer.unref === "function") {
        timer.unref();
      }

      try {
        await tick();
      } catch (error) {
        if (isProspectingConfigurationSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }
    },
    async stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    async triggerProcessingPass() {
      try {
        await tick();
      } catch (error) {
        if (isProspectingConfigurationSchemaMissing(error)) {
          schemaReady = false;
          return;
        }
        throw error;
      }
    },
    isAvailable() {
      return schemaReady;
    },
  };
}

function defaultRuntimeErrorReporter(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Prospecting runtime tick failed: ${message}\n`);
}

function isProspectingConfigurationSchemaMissing(error) {
  return (
    error?.code === "P2021" &&
    typeof error?.message === "string" &&
    error.message.includes("prospecting_configurations")
  );
}

async function claimProspectingConfigurationRun(prisma, configuration, claimedAt) {
  if (
    !prisma?.prospectingConfiguration ||
    typeof prisma.prospectingConfiguration.updateMany !== "function" ||
    !(configuration?.updatedAt instanceof Date)
  ) {
    return true;
  }

  const result = await prisma.prospectingConfiguration.updateMany({
    where: {
      id: configuration.id,
      updatedAt: configuration.updatedAt,
    },
    data: {
      latestRunStatus: "RUNNING",
      updatedAt: claimedAt instanceof Date ? claimedAt : new Date(claimedAt),
    },
  });

  return result?.count === 1;
}

function isProspectingConfigurationDue(configuration, currentTime) {
  const snapshotCadence = configuration?.uiSnapshotJson?.cadence ?? {};
  const runMode = String(snapshotCadence.runMode ?? "Scheduled").toLowerCase();

  if (runMode === "manual only" || runMode === "manual-only") {
    return false;
  }

  const nowTime = currentTime instanceof Date ? currentTime : new Date(currentTime);
  const lastRunAt = configuration?.lastRunAt ? new Date(configuration.lastRunAt) : null;
  const nextRunAt = configuration?.nextRunAt ? new Date(configuration.nextRunAt) : null;

  if (nextRunAt instanceof Date && !Number.isNaN(nextRunAt.getTime())) {
    return nextRunAt <= nowTime;
  }

  if (lastRunAt instanceof Date && !Number.isNaN(lastRunAt.getTime())) {
    return nowTime.getTime() - lastRunAt.getTime() >= 60 * 60 * 1000;
  }

  return true;
}

module.exports = {
  createProspectingRuntime,
};
