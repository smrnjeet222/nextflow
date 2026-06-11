import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { stripRuntimeNodeState } from "@/validators/workflow";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const workflow = await prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (workflow.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const nodes = workflow.nodes as unknown as Parameters<typeof stripRuntimeNodeState>[0];
    const exportData = {
      name: workflow.name,
      nodes: stripRuntimeNodeState(nodes),
      edges: workflow.edges,
      viewport: workflow.viewport,
    };

    const fileName = `${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-export.json`;

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error(`[api/workflows/[id]/export] GET Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
