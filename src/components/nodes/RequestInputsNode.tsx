"use client";

import { useState } from "react";
import { Position } from "@xyflow/react";
import { Database, Plus, Trash2, Image as ImageIcon, FileText, Upload, X } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import NodeShell from "./shared/NodeShell";
import TypedHandle from "./shared/TypedHandle";
import { HandleDataType } from "@/lib/constants";
import { RequestInputsField, NodeData } from "@/types/workflow";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_ACCEPT,
  isTransloaditConfigured,
  uploadImageViaTransloadit,
} from "@/lib/uppy-upload";

interface FieldUploadState {
  progress?: number;
  error?: string;
}

export default function RequestInputsNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const { updateNodeData, takeSnapshot } = useFlowStore();
  const [showAddFieldMenu, setShowAddFieldMenu] = useState(false);
  const [uploadState, setUploadState] = useState<Record<string, FieldUploadState>>({});
  const fields: RequestInputsField[] = data.fields || [];

  const handleAddField = (type: "text" | "image") => {
    takeSnapshot();
    const count = fields.filter((f) => f.type === type).length + 1;
    const newField: RequestInputsField = {
      id: `${type}_field_${Date.now()}`,
      name: `${type}_field_${count}`,
      type,
      value: type === "text" ? "" : "",
    };
    updateNodeData(id, { fields: [...fields, newField] });
    setShowAddFieldMenu(false);
  };

  const handleRemoveField = (fieldId: string) => {
    takeSnapshot();
    updateNodeData(id, {
      fields: fields.filter((f) => f.id !== fieldId),
    });
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    updateNodeData(id, {
      fields: fields.map((f) => (f.id === fieldId ? { ...f, value } : f)),
    });
  };

  const handleFieldNameChange = (fieldId: string, name: string) => {
    updateNodeData(id, {
      fields: fields.map((f) => (f.id === fieldId ? { ...f, name: name.trim().replace(/\s+/g, "_") } : f)),
    });
  };

  // Image upload via Uppy + Transloadit (base64 fallback when unconfigured)
  const handleImageFileChange = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadState((s) => ({ ...s, [fieldId]: { error: "Only jpg, png, webp or gif images are allowed" } }));
      return;
    }

    if (!isTransloaditConfigured()) {
      convertToBase64(file, fieldId);
      return;
    }

    setUploadState((s) => ({ ...s, [fieldId]: { progress: 0 } }));
    try {
      const url = await uploadImageViaTransloadit(file, (percent) =>
        setUploadState((s) => ({ ...s, [fieldId]: { progress: percent } }))
      );
      handleFieldChange(fieldId, url);
      setUploadState((s) => ({ ...s, [fieldId]: {} }));
    } catch (err) {
      console.error("Transloadit upload failed, falling back to base64:", err);
      setUploadState((s) => ({ ...s, [fieldId]: {} }));
      convertToBase64(file, fieldId);
    }
  };

  const convertToBase64 = (file: File, fieldId: string) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleFieldChange(fieldId, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <NodeShell
      id={id}
      type="request-inputs"
      label={data.label || "Request Inputs"}
      status={data.status}
      selected={selected}
      error={data.error}
      duration={data.duration}
      icon={<Database size={16} />}
    >
      <div className="flex flex-col gap-4">
        {/* Fields list */}
        {fields.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-gray-100 rounded-lg text-xs text-gray-400">
            No input fields. Click below to add one.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.id} className="relative flex flex-col gap-1.5 p-2 bg-gray-50/70 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                
                {/* Field Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {field.type === "text" ? (
                      <FileText size={12} className="text-amber-500" />
                    ) : (
                      <ImageIcon size={12} className="text-blue-500" />
                    )}
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => handleFieldNameChange(field.id, e.target.value)}
                      className="font-medium text-[10px] text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-24 px-0.5 truncate"
                    />
                  </div>

                  <button
                    onClick={() => handleRemoveField(field.id)}
                    className="text-gray-400 hover:text-red-500 rounded p-0.5 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Field Input Content */}
                <div className="mr-4">
                  {field.type === "text" ? (
                    <textarea
                      value={field.value || ""}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder="Enter prompt content..."
                      rows={2}
                      className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-sans"
                    />
                  ) : field.value ? (
                    <div className="relative border border-gray-200 rounded bg-white overflow-hidden h-24 flex items-center justify-center group/img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt="Upload Preview"
                        className="h-full w-full object-contain"
                      />
                      <button
                        onClick={() => handleFieldChange(field.id, "")}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : uploadState[field.id]?.progress !== undefined ? (
                    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-violet-300 rounded h-20 text-center bg-violet-50/30">
                      <span className="text-[10px] text-violet-600 font-semibold">
                        Uploading… {uploadState[field.id].progress}%
                      </span>
                      <div className="w-3/4 h-1 bg-violet-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all"
                          style={{ width: `${uploadState[field.id].progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-gray-300 rounded hover:border-violet-400 hover:bg-violet-50/10 cursor-pointer h-20 text-center transition-colors">
                      <Upload size={14} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500 font-medium">Upload Image</span>
                      <span className="text-[8px] text-gray-400">jpg, png, webp, gif</span>
                      <input
                        type="file"
                        accept={ALLOWED_IMAGE_ACCEPT}
                        onChange={(e) => handleImageFileChange(field.id, e)}
                        className="sr-only"
                      />
                    </label>
                  )}
                  {uploadState[field.id]?.error && (
                    <p className="text-[9px] text-red-500 mt-1">{uploadState[field.id].error}</p>
                  )}
                </div>

                {/* Connection Source Handle — keyed by stable field.id so
                    renaming a field never breaks existing edges */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[9px]">
                  <TypedHandle
                    type="source"
                    position={Position.Right}
                    id={`${field.id}:${field.type}`}
                    dataType={field.type === "text" ? HandleDataType.TEXT : HandleDataType.IMAGE}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Field Button */}
        <div className="relative">
          <button
            onClick={() => setShowAddFieldMenu(!showAddFieldMenu)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Plus size={14} />
            Add Field
          </button>

          {showAddFieldMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white rounded-lg border border-gray-100 shadow-lg py-1 z-50">
              <button
                onClick={() => handleAddField("text")}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <FileText size={12} className="text-amber-500" />
                Text Field
              </button>
              <button
                onClick={() => handleAddField("image")}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <ImageIcon size={12} className="text-blue-500" />
                Image Field
              </button>
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  );
}
