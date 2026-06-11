import { Loader2 } from "lucide-react";

export default function WorkflowLoading() {
  return (
    <div className="flex-1 min-h-screen flex flex-col">
      {/* Top bar placeholder */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 animate-pulse">
        <div className="h-6 w-6 bg-gray-200 rounded-lg" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-8 w-20 bg-gray-100 rounded-lg" />
          <div className="h-8 w-24 bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Canvas placeholder */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Loading workflow…
          </span>
        </div>
      </div>
    </div>
  );
}
