"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Scissors, Brain, Sparkles, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useFlowStore } from "@/stores/flowStore";

interface NodePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NodeOption {
  id: "crop-image" | "gemini";
  name: string;
  description: string;
  category: "Image" | "Video" | "Audio" | "Others";
  icon: React.ReactNode;
}

export default function NodePicker({ isOpen, onClose }: NodePickerProps) {
  const { addNode } = useFlowStore();
  const { screenToFlowPosition } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const nodeOptions: NodeOption[] = [
    {
      id: "crop-image",
      name: "Crop Image",
      description: "Crop image files by percentages using FFmpeg static binaries.",
      category: "Image",
      icon: <Scissors className="text-violet-500" size={18} />,
    },
    {
      id: "gemini",
      name: "Gemini 3.1 Pro",
      description: "Call Google Gemini Studio LLMs for text prompts and vision.",
      category: "Others",
      icon: <Brain className="text-blue-500" size={18} />,
    },
  ];

  const categories = ["All", "Recent", "Image", "Video", "Audio", "Others"];

  const filteredOptions = nodeOptions.filter((opt) => {
    const matchesSearch =
      opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      activeCategory === "All" ||
      (activeCategory === "Recent" && opt.id === "gemini") || // Mock recent
      opt.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const handleSelectNode = (type: "crop-image" | "gemini") => {
    // Drop the node at the visible canvas center
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNode(type, center);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-xl flex flex-col max-h-[480px] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600" size={16} />
            <h3 className="text-base font-bold text-gray-900">Add Workflow Node</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search workflow nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Categories Sidebar */}
          <div className="w-1/3 border-r border-gray-100 overflow-y-auto bg-gray-50/20 py-2">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left px-5 py-2 text-xs font-semibold border-l-2 transition-all ${
                    isActive
                      ? "text-blue-600 border-blue-600 bg-blue-50/30"
                      : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Nodes list */}
          <div className="w-2/3 overflow-y-auto p-4 flex flex-col gap-2 bg-white">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400 font-semibold">
                No nodes match your filters.
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectNode(opt.id)}
                  className="w-full text-left p-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/10 flex items-start gap-3.5 transition-all group"
                >
                  <div className="p-2 border border-gray-100 bg-gray-50 rounded-lg shrink-0 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                    {opt.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {opt.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-normal mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
