import Link from "next/link";
import { SearchX, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
          <SearchX size={22} className="text-gray-400" />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-base text-gray-900">Page not found</h1>
          <p className="text-xs text-gray-500 leading-relaxed">
            This page doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors mt-2"
        >
          <LayoutDashboard size={13} />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
