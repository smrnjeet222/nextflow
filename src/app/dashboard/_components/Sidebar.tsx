"use client";

import { useState, useSyncExternalStore } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Workflow,
  Folder,
  LayoutTemplate,
  Library,
  Boxes,
  History,
  Plug,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

const NAV_SECTIONS: { items: { icon: typeof Folder; label: string; active?: boolean }[] }[] = [
  {
    items: [
      { icon: Search, label: "Search" },
    ],
  },
  {
    items: [
      { icon: Folder, label: "Workflows", active: true },
      { icon: LayoutTemplate, label: "Templates" },
      { icon: Library, label: "Library" },
      { icon: Boxes, label: "Nodes" },
      { icon: History, label: "Runs" },
      { icon: Plug, label: "API / MCP" },
    ],
  },
];

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Presentational sidebar — nav items are visual only. Collapses to an
 * icon rail; the toggle is the only interactive piece besides UserButton.
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  return (
    <aside
      className={`${
        collapsed ? "w-[64px]" : "w-[248px]"
      } shrink-0 h-full flex flex-col border-r border-gray-200/80 bg-white transition-[width] duration-300 ease-in-out`}
    >
      {/* Logo + collapse toggle */}
      <div className="h-16 flex items-center justify-between px-4 shrink-0">
        <div
          className={`flex items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out ${
            collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
          }`}
        >
          <div className="p-1.5 bg-violet-600 rounded-lg text-white shrink-0">
            <Workflow size={18} />
          </div>
          <span className="font-bold text-[17px] text-gray-900 tracking-tight whitespace-nowrap">
            Next<span className="text-violet-600">Flow</span>
          </span>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i} className="space-y-0.5">
            {section.items.map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                className={`w-full flex items-center gap-3 rounded-lg text-[13.5px] font-medium px-3 py-2 transition-colors ${
                  active
                    ? "text-violet-700 bg-violet-50"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/70"
                }`}
                title={collapsed ? label : undefined}
              >
                <Icon size={17} className="shrink-0" />
                <span
                  className={`truncate whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out ${
                    collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
                  }`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2 space-y-0.5">
        <button
          className="w-full flex items-center gap-3 rounded-lg text-[13.5px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100/70 px-3 py-2 transition-colors"
          title={collapsed ? "Settings" : undefined}
        >
          <Settings size={17} className="shrink-0" />
          <span
            className={`truncate whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out ${
              collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
            }`}
          >
            Settings
          </span>
        </button>

        <div className="flex items-center pt-2 pb-1.5 px-2">
          {mounted ? (
            <UserButton
              showName={!collapsed}
              appearance={{
                elements: {
                  userButtonBox: {
                    flexDirection: "row-reverse",
                  },
                  userButtonOuterIdentifier: "text-[13px] font-medium text-gray-700",
                },
              }}
            />
          ) : (
            <div
              className={`h-8 rounded-full bg-gray-100 transition-[width] duration-300 ease-in-out ${
                collapsed ? "w-8" : "w-[152px]"
              }`}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </aside>
  );
}
