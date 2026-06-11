import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { UpdateWorkflowSchema } from "@/validators/workflow";

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

    return NextResponse.json(workflow);
  } catch (err) {
    console.error(`[api/workflows/[id]] GET Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await req.json();
    const parsed = UpdateWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }

    // Clean up nodes before saving: ensure transient states like 'running' or 'pending'
    // aren't persisted to the database. Terminal states and outputs are kept.
    const nodesToSave = parsed.data.nodes?.map((node) => {
      const { status } = node.data;
      if (status === "running" || status === "pending") {
        return {
          ...node,
          data: { ...node.data, status: "idle" as const },
          selected: false,
        };
      }
      return { ...node, selected: false };
    });

    const updatedWorkflow = await prisma.workflow.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(nodesToSave !== undefined
          ? { nodes: nodesToSave as Prisma.InputJsonValue }
          : {}),
        ...(parsed.data.edges !== undefined
          ? { edges: parsed.data.edges as Prisma.InputJsonValue }
          : {}),
        ...(parsed.data.viewport !== undefined ? { viewport: parsed.data.viewport } : {}),
      },
    });

    return NextResponse.json(updatedWorkflow);
  } catch (err) {
    console.error(`[api/workflows/[id]] PATCH Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
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

    await prisma.workflow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[api/workflows/[id]] DELETE Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
