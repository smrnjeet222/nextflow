import { NextResponse } from "next/server";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import prisma from "@/lib/prisma";

/**
 * Mints a Trigger.dev public access token scoped to a single workflow run's
 * parent executor run. The client subscribes to that run via useRealtimeRun
 * and reads per-node progress from its metadata.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await clerkAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    if (!runId) {
      return NextResponse.json({ error: "runId parameter is required" }, { status: 400 });
    }

    const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (run.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }
    if (!run.triggerRunId) {
      return NextResponse.json({ error: "Run has no Trigger.dev run yet" }, { status: 409 });
    }

    const token = await triggerAuth.createPublicToken({
      scopes: {
        read: { runs: [run.triggerRunId] },
      },
      expirationTime: "2h",
    });

    return NextResponse.json({ token, triggerRunId: run.triggerRunId });
  } catch (err) {
    console.error("[api/trigger-token] GET Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
