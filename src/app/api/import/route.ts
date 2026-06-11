import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ImportWorkflowSchema, stripRuntimeNodeState } from "@/validators/workflow";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ImportWorkflowSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
    }

    const newWorkflow = await prisma.workflow.create({
      data: {
        userId,
        name: `${parsed.data.name} (Imported)`,
        // Foreign JSON must not carry stale run state (outputs, statuses)
        nodes: stripRuntimeNodeState(parsed.data.nodes) as object[],
        edges: parsed.data.edges as object[],
        viewport: parsed.data.viewport ?? { x: 0, y: 0, zoom: 1 },
      },
    });

    return NextResponse.json(newWorkflow, { status: 201 });
  } catch (err) {
    console.error("[api/import] POST Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
