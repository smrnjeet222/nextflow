import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { CreateWorkflowSchema } from "@/validators/workflow";
import { getDefaultWorkflowNodes } from "@/lib/default-workflow";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's workflows (sample seeding happens on the dashboard page)
    const workflows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(workflows);
  } catch (err) {
    console.error("[api/workflows] GET Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
    }

    // New canvases always open with Request-Inputs + Response pre-placed
    const defaults = getDefaultWorkflowNodes();
    const newWorkflow = await prisma.workflow.create({
      data: {
        userId,
        name: parsed.data.name || "Untitled Workflow",
        nodes: (parsed.data.nodes?.length ? parsed.data.nodes : defaults.nodes) as object[],
        edges: (parsed.data.edges?.length ? parsed.data.edges : defaults.edges) as object[],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    return NextResponse.json(newWorkflow, { status: 201 });
  } catch (err) {
    console.error("[api/workflows] POST Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
