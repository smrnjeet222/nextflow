import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { UpdateWorkflowSchema, WorkflowNodeInput } from "@/validators/workflow";

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

    // Runtime fields (status/output/error/duration) are owned by the executor.
    // Whatever the client sends for them is discarded and replaced with the
    // current DB values, so a save racing a run completion can never clobber
    // results. New nodes simply carry no runtime state yet.
    const existingById = new Map(
      (workflow.nodes as unknown as WorkflowNodeInput[]).map((n) => [n.id, n])
    );
    const nodesToSave = parsed.data.nodes?.map((node) => {
      const { status, output, error, duration, ...data } = node.data;
      void status; void output; void error; void duration;
      const existing = existingById.get(node.id)?.data;
      return {
        ...node,
        selected: false,
        data: {
          ...data,
          ...(existing && {
            status: existing.status,
            output: existing.output,
            error: existing.error,
            duration: existing.duration,
          }),
        },
      };
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
