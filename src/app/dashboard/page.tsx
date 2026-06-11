import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { SAMPLES } from "@/lib/sample-workflow";
import Sidebar from "./_components/Sidebar";
import HeaderActions from "./_components/HeaderActions";
import SamplesSection from "./_components/SamplesSection";
import WorkflowList from "./_components/WorkflowList";
import WorkflowsSkeleton from "./_components/WorkflowsSkeleton";
import WorkflowsBoundary from "./_components/WorkflowsBoundary";

/**
 * The shell (sidebar, header, samples) renders immediately. Only the
 * user's workflow list talks to the database, so it gets its own
 * Suspense + error boundary and streams in without blocking the page.
 */
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null; // middleware redirects unauthenticated traffic

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fafafa]">
      <Sidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 pt-10 pb-16">
            <header className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
                  Workflows
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Build, run, and monitor your LLM workflows.
                </p>
              </div>
              <HeaderActions />
            </header>

            <SamplesSection
              samples={SAMPLES.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
              }))}
            />

            <section className="mt-12">
              <WorkflowsBoundary>
                <Suspense fallback={<WorkflowsSkeleton />}>
                  <WorkflowList userId={userId} />
                </Suspense>
              </WorkflowsBoundary>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
