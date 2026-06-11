import Sidebar from "./_components/Sidebar";
import WorkflowsSkeleton from "./_components/WorkflowsSkeleton";

/**
 * Instant route-level fallback while the dashboard page (auth + data)
 * renders on the server. Mirrors the page shell so the swap is seamless.
 */
export default function DashboardLoading() {
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
              <div className="flex items-center gap-2 animate-pulse">
                <div className="h-9 w-28 bg-white border border-gray-200 rounded-lg" />
                <div className="h-9 w-36 bg-gray-200 rounded-lg" />
              </div>
            </header>

            {/* Samples row placeholder */}
            <section className="mt-10 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                  >
                    <div className="h-28 bg-gray-100 border-b border-gray-100" />
                    <div className="p-3.5">
                      <div className="h-3.5 w-2/3 bg-gray-200 rounded" />
                      <div className="mt-2 h-3 w-full bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12">
              <WorkflowsSkeleton />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
