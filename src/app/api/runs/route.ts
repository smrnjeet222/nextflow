import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { reapIfStale } from "@/lib/run-reaper";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId parameter is required" }, { status: 400 });
    }

    // Verify workflow belongs to user
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (workflow.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const runs = await prisma.workflowRun.findMany({
      where: { workflowId },
      include: {
        nodeRuns: {
          orderBy: { startedAt: "asc" },
        },
      },
      orderBy: [
        { startedAt: "desc" },
        { id: "desc" }
      ],
    });

    return NextResponse.json(await Promise.all(runs.map(reapIfStale)));
  } catch (err) {
    console.error("[api/runs] GET Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
