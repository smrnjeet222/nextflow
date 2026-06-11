import prisma from "@/lib/prisma";
import WorkflowGrid from "./WorkflowGrid";

/**
 * The only data-fetching piece of the dashboard. Renders inside the
 * workflows Suspense/error boundary so a slow or failing query never
 * takes down the rest of the page.
 */
export default async function WorkflowList({ userId }: { userId: string }) {
  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, updatedAt: true },
  });

  return (
    <WorkflowGrid
      workflows={workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        updatedAt: w.updatedAt.toISOString(),
      }))}
    />
  );
}
