import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { WorkflowNode, WorkflowEdge } from "@/types/workflow";
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
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        include: { nodeRuns: { orderBy: { startedAt: "asc" } } },
      },
    },
  });

  if (!workflow || workflow.userId !== userId) {
    notFound();
  }

  const { runs, ...rest } = workflow;

  return (
    <WorkflowEditor
      workflowId={rest.id}
      initialName={rest.name}
      initialNodes={rest.nodes as unknown as WorkflowNode[]}
      initialEdges={rest.edges as unknown as WorkflowEdge[]}
      initialViewport={(rest.viewport as Viewport | null) ?? undefined}
      initialRuns={JSON.parse(JSON.stringify(runs))}
    />
  );
}
