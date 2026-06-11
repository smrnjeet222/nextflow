import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { SAMPLES } from "@/lib/sample-workflow";
import DashboardShell from "./_components/DashboardShell";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null; // middleware redirects unauthenticated traffic

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, updatedAt: true },
  });

  return (
    <DashboardShell
      workflows={workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        updatedAt: w.updatedAt.toISOString(),
      }))}
      samples={SAMPLES.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      }))}
    />
  );
}
