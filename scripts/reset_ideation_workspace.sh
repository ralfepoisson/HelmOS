#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ID="${1:-73cd8e9f-9a6b-4046-b78f-b396b5685658}"

cd "$ROOT_DIR"

echo "Resetting ideation workspace: $WORKSPACE_ID"

WORKSPACE_ID="$WORKSPACE_ID" node - <<'NODE'
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const workspaceId = process.env.WORKSPACE_ID;

const BUSINESS_TYPE_LABELS = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
  RESEARCH_AND_DEVELOPMENT: 'R&D',
  MARKETPLACE: 'Marketplace',
  PLATFORM: 'Platform',
  AGENCY: 'Agency',
  OTHER: 'Mixture',
};

const STAGE_SEEDS = [
  { stageKey: 'IDEATION', displayOrder: 1, status: 'CURRENT', unlockState: 'UNLOCKED' },
  { stageKey: 'VALUE_PROPOSITION', displayOrder: 2, status: 'LOCKED', unlockState: 'LOCKED' },
  { stageKey: 'CUSTOMER_SEGMENTS', displayOrder: 3, status: 'LOCKED', unlockState: 'LOCKED' },
  { stageKey: 'BUSINESS_MODEL', displayOrder: 4, status: 'LOCKED', unlockState: 'LOCKED' },
  { stageKey: 'MARKET_RESEARCH', displayOrder: 5, status: 'LOCKED', unlockState: 'LOCKED' },
];

(async () => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      company: true,
      documents: {
        include: {
          sections: true,
        },
      },
      chatThreads: {
        orderBy: { createdAt: 'asc' },
      },
      stageProgress: true,
    },
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const document = workspace.documents.find((entry) => entry.documentType === 'IDEATION') ?? workspace.documents[0] ?? null;
  if (!document) {
    throw new Error(`Workspace ${workspaceId} does not have an ideation document`);
  }

  const sectionIds = document.sections.map((section) => section.id);
  const threadIds = workspace.chatThreads.map((thread) => thread.id);
  const primaryThread = workspace.chatThreads[0] ?? null;
  const extraThreadIds = workspace.chatThreads.slice(1).map((thread) => thread.id);
  const businessTypeLabel = BUSINESS_TYPE_LABELS[workspace.company.businessType] ?? 'Business';
  const agentSummary = `A new ${businessTypeLabel.toLowerCase()} business idea has been created. Start by clarifying the problem statement.`;

  await prisma.$transaction(async (tx) => {
    const agentRuns = threadIds.length
      ? await tx.agentRun.findMany({
          where: { threadId: { in: threadIds } },
          select: { id: true },
        })
      : [];
    const runIds = agentRuns.map((run) => run.id);

    if (runIds.length > 0) {
      await tx.agentRunEffect.deleteMany({
        where: { agentRunId: { in: runIds } },
      });

      await tx.documentInsight.deleteMany({
        where: {
          OR: [
            { agentRunId: { in: runIds } },
            { documentId: document.id },
          ],
        },
      });
    } else {
      await tx.documentInsight.deleteMany({
        where: { documentId: document.id },
      });
    }

    if (sectionIds.length > 0) {
      await tx.sectionVersion.deleteMany({
        where: { sectionId: { in: sectionIds } },
      });
    }

    if (runIds.length > 0) {
      await tx.agentRun.deleteMany({
        where: { id: { in: runIds } },
      });
    }

    if (threadIds.length > 0) {
      await tx.chatMessage.deleteMany({
        where: { threadId: { in: threadIds } },
      });
    }

    await tx.activityLog.deleteMany({
      where: { workspaceId },
    });

    await tx.strategySection.updateMany({
      where: { documentId: document.id },
      data: {
        content: null,
        status: 'NOT_STARTED',
        refinementState: 'EMPTY',
        agentConfidence: null,
        completionPercent: 0,
        lastUpdatedByType: 'SYSTEM',
        lastUpdatedByUserId: null,
        lastUpdatedAt: null,
        versionNo: 1,
      },
    });

    await tx.strategyDocument.update({
      where: { id: document.id },
      data: {
        completenessPercent: 0,
        qualityState: 'IN_PROGRESS',
        agentSummary,
      },
    });

    await tx.workspace.update({
      where: { id: workspaceId },
      data: {
        currentStage: 'IDEATION',
      },
    });

    await Promise.all(
      STAGE_SEEDS.map((seed) =>
        tx.stageProgress.updateMany({
          where: {
            workspaceId,
            stageKey: seed.stageKey,
          },
          data: {
            displayOrder: seed.displayOrder,
            status: seed.status,
            unlockState: seed.unlockState,
            unlockReason:
              seed.stageKey === 'IDEATION'
                ? 'Ideation is the active starting stage.'
                : 'Unlocks once the ideation draft is mature enough for the next strategy tool.',
            completionPercent: 0,
            qualityChecks: null,
            enteredAt: seed.stageKey === 'IDEATION' ? new Date() : null,
            completedAt: null,
          },
        })
      )
    );

    let threadId = primaryThread?.id ?? null;
    if (!threadId) {
      const createdThread = await tx.chatThread.create({
        data: {
          workspaceId,
          documentId: document.id,
          title: 'Ideation thread',
          status: 'ACTIVE',
          createdByUserId: workspace.createdByUserId,
        },
      });
      threadId = createdThread.id;
    } else {
      await tx.chatThread.update({
        where: { id: threadId },
        data: {
          documentId: document.id,
          title: 'Ideation thread',
          status: 'ACTIVE',
          createdByUserId: workspace.createdByUserId,
        },
      });
    }

    if (extraThreadIds.length > 0) {
      await tx.chatThread.deleteMany({
        where: { id: { in: extraThreadIds } },
      });
    }

    await tx.chatMessage.create({
      data: {
        threadId,
        messageIndex: 1,
        senderType: 'AGENT',
        messageText: 'Hi there. Please tell me about your business idea.',
        messageFormat: 'MARKDOWN',
        status: 'SENT',
      },
    });
  });

  const summary = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      documents: {
        include: {
          sections: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      },
      chatThreads: {
        include: {
          messages: {
            orderBy: { messageIndex: 'asc' },
          },
        },
      },
    },
  });

  const refreshedDocument = summary.documents[0];
  const refreshedThread = summary.chatThreads[0];

  console.log(JSON.stringify({
    workspaceId,
    workspaceName: summary.name,
    document: {
      id: refreshedDocument.id,
      completenessPercent: refreshedDocument.completenessPercent,
      qualityState: refreshedDocument.qualityState,
      agentSummary: refreshedDocument.agentSummary,
    },
    sections: refreshedDocument.sections.map((section) => ({
      sectionKey: section.sectionKey,
      status: section.status,
      completionPercent: section.completionPercent,
      hasContent: section.content !== null && section.content !== '',
    })),
    thread: {
      id: refreshedThread.id,
      messageCount: refreshedThread.messages.length,
      messages: refreshedThread.messages.map((message) => ({
        index: message.messageIndex,
        senderType: message.senderType,
        text: message.messageText,
      })),
    },
  }, null, 2));

  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error.message);
  await prisma.$disconnect();
  process.exit(1);
});
NODE

WORKSPACE_ID="$WORKSPACE_ID" src/backend/.venv/bin/python - <<'PY'
import json
import os
import sys

import psycopg

workspace_id = os.environ["WORKSPACE_ID"]
dsn = "postgresql://postgres:postgres@localhost:5432/helmos"

try:
    conn = psycopg.connect(dsn)
except Exception as exc:
    print(f"Failed to connect to gateway DB: {exc}", file=sys.stderr)
    sys.exit(1)

with conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            select id
            from sessions
            where metadata->>'workspace_id' = %s
            """,
            (workspace_id,),
        )
        session_ids = [row[0] for row in cur.fetchall()]

        run_ids = []
        if session_ids:
            cur.execute(
                """
                select id
                from agent_runs
                where session_id = any(%s)
                """,
                (session_ids,),
            )
            run_ids = [row[0] for row in cur.fetchall()]

        if run_ids:
            cur.execute("delete from audit_logs where run_id = any(%s)", (run_ids,))
            cur.execute("delete from approval_requests where run_id = any(%s)", (run_ids,))
            cur.execute("delete from agent_checkpoints where run_id = any(%s)", (run_ids,))
            cur.execute("delete from artifacts where run_id = any(%s)", (run_ids,))

        if session_ids:
            cur.execute("delete from artifacts where session_id = any(%s)", (session_ids,))
            cur.execute("delete from agent_runs where session_id = any(%s)", (session_ids,))
            cur.execute("delete from sessions where id = any(%s)", (session_ids,))

        print(json.dumps({
            "workspaceId": workspace_id,
            "gatewaySessionsDeleted": len(session_ids),
            "gatewayRunsDeleted": len(run_ids),
        }, indent=2))

conn.close()
PY

echo "Reset complete."
