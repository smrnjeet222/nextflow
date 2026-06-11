import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { runId } = await params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        nodeRuns: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (run.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    return NextResponse.json(run);
  } catch (err) {
    console.error(`[api/runs/[runId]] GET Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
