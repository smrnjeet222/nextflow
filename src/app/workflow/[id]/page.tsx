import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { WorkflowRunDetail } from "@/types/execution";
import { Viewport } from "@xyflow/react";
import WorkflowEditor from "./_components/WorkflowEditor";

export default async function WorkflowCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({
    where: { id },
  });

  if (!workflow || workflow.userId !== userId) {
    notFound();
  }

  // Deliberately not awaited: the canvas renders immediately while the run
  // history streams into the editor's Suspense boundary when it resolves.
  const runsPromise: Promise<WorkflowRunDetail[]> = prisma.workflowRun
    .findMany({
      where: { workflowId: id },
      orderBy: { startedAt: "desc" },
      include: { nodeRuns: { orderBy: { startedAt: "asc" } } },
    })
    .then((runs) => JSON.parse(JSON.stringify(runs)));

  return (
    <WorkflowEditor
      workflowId={workflow.id}
      initialName={workflow.name}
      initialNodes={workflow.nodes as unknown as WorkflowNode[]}
      initialEdges={workflow.edges as unknown as WorkflowEdge[]}
      initialViewport={(workflow.viewport as Viewport | null) ?? undefined}
      initialRunsPromise={runsPromise}
    />
  );
}
