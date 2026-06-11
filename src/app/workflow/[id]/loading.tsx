export default function WorkflowLoading() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
      <div className="flex-1 flex overflow-hidden w-full relative animate-pulse">
        {/* Canvas area */}
        <div className="flex-1 relative">
          {/* Floating top bar */}
          <div className="absolute top-4 left-4 right-4 z-30 flex items-start justify-between select-none">
            {/* Left — back + name pill */}
            <div className="flex items-center gap-2 bg-white rounded-full border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.08)] pl-2 pr-4 py-1.5">
              <div className="w-7 h-7 bg-gray-100 rounded-full" />
              <div className="h-4 w-44 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-50 border border-gray-100 rounded-full" />
            </div>

            {/* Right — undo/redo, export, run, history toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-gray-200 rounded-full overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <div className="p-2.5 border-r border-gray-100">
                  <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
                </div>
                <div className="p-2.5">
                  <div className="w-3.5 h-3.5 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="h-9 w-[88px] bg-white border border-gray-200 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)]" />
              <div className="h-9 w-32 bg-violet-300 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.12)]" />
              <div className="h-9 w-9 bg-white border border-gray-200 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)]" />
            </div>
          </div>

          {/* Dotted canvas backdrop */}
          <div className="h-full w-full bg-gray-50 bg-[radial-gradient(#e0e0e0_1.5px,transparent_1.5px)] [background-size:20px_20px]" />
        </div>

        {/* History panel (open by default) */}
        <div className="relative h-full flex shrink-0 select-none z-30">
          <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-6 h-12 bg-white border border-r-0 border-gray-200 shadow-[-2px_0_8px_rgba(0,0,0,0.04)] rounded-l-lg" />

          <div className="bg-white border-l border-gray-200 h-full w-80 flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-200 rounded" />
              </div>
              <div className="w-7 h-7 bg-gray-100 rounded-lg" />
            </div>

            {/* Run rows */}
            <div className="flex-1 overflow-hidden divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-14 bg-gray-200 rounded" />
                      <div className="h-4 w-14 bg-gray-100 rounded" />
                    </div>
                    <div className="h-2.5 w-28 bg-gray-100 rounded" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="h-3 w-10 bg-gray-100 rounded" />
                    <div className="w-3.5 h-3.5 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
