/**
 * Suspense fallback for the workflows section only — the surrounding
 * shell (sidebar, header, templates) renders immediately around it.
 */
export default function WorkflowsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="mt-2 h-3 w-56 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-60 bg-gray-100 border border-gray-200 rounded-lg" />
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="h-28 bg-gray-100 border-b border-gray-100" />
            <div className="p-3.5">
              <div className="h-3.5 w-2/3 bg-gray-200 rounded" />
              <div className="mt-2 h-3 w-1/3 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
