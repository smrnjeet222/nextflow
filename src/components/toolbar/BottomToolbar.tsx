"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Home } from "lucide-react";
import NodePicker from "./NodePicker";

export default function BottomToolbar() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-full border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-4 py-2 flex items-center gap-4 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
        {/* Dashboard Button */}
        <Link
          href="/dashboard"
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-colors"
          title="Back to Dashboard"
        >
          <Home size={18} />
        </Link>

        <div className="w-px h-6 bg-gray-200" />

        {/* Plus Add Node Button */}
        <button
          onClick={() => setIsPickerOpen(true)}
          className="w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-sm hover:shadow transition-all hover:scale-105 active:scale-95"
          title="Add New Node"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Node Picker Modal */}
      <NodePicker isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} />
    </>
  );
}
