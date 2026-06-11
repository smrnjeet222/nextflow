"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ImportWorkflowSchema, stripRuntimeNodeState } from "@/validators/workflow";
import { getDefaultWorkflowNodes } from "@/lib/default-workflow";
import { SAMPLES } from "@/lib/sample-workflow";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

async function requireOwnedWorkflow(id: string, userId: string) {
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow || workflow.userId !== userId) {
    throw new Error("Workflow not found");
  }
  return workflow;
}

export async function createWorkflowAction(): Promise<never> {
  const userId = await requireUserId();
  const defaults = getDefaultWorkflowNodes();

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: "Untitled Workflow",
      nodes: defaults.nodes as unknown as Prisma.InputJsonValue,
      edges: defaults.edges as unknown as Prisma.InputJsonValue,
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  });

  redirect(`/workflow/${workflow.id}`);
}

export async function createSampleWorkflowAction(sampleId: string): Promise<{ id: string } | { error: string }> {
  const userId = await requireUserId();
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!sample) return { error: "Sample not found" };

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: sample.name,
      nodes: sample.nodes as unknown as Prisma.InputJsonValue,
      edges: sample.edges as unknown as Prisma.InputJsonValue,
      viewport: sample.viewport || { x: 0, y: 0, zoom: 1 },
    },
  });

  revalidatePath("/dashboard");
  return { id: workflow.id };
}

const RenameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
});

export async function renameWorkflowAction(input: z.infer<typeof RenameSchema>) {
  const userId = await requireUserId();
  const { id, name } = RenameSchema.parse(input);
  await requireOwnedWorkflow(id, userId);

  await prisma.workflow.update({ where: { id }, data: { name } });
  revalidatePath("/dashboard");
}

export async function deleteWorkflowAction(id: string) {
  const userId = await requireUserId();
  z.string().min(1).parse(id);
  await requireOwnedWorkflow(id, userId);

  await prisma.workflow.delete({ where: { id } });
  revalidatePath("/dashboard");
}

export async function importWorkflowAction(raw: unknown): Promise<{ id: string } | { error: string }> {
  const userId = await requireUserId();

  const parsed = ImportWorkflowSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid workflow JSON structure" };
  }

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name: `${parsed.data.name} (Imported)`,
      nodes: stripRuntimeNodeState(parsed.data.nodes) as unknown as Prisma.InputJsonValue,
      edges: parsed.data.edges as unknown as Prisma.InputJsonValue,
      viewport: parsed.data.viewport ?? { x: 0, y: 0, zoom: 1 },
    },
  });

  revalidatePath("/dashboard");
  return { id: workflow.id };
}
