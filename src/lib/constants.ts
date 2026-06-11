export enum HandleDataType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  FILE = "file",
  ANY = "any",
}

export const DATA_TYPE_COLORS: Record<HandleDataType, { hex: string; border: string; bg: string }> = {
  [HandleDataType.TEXT]: { hex: "#F59E0B", border: "border-amber-500", bg: "bg-amber-500" },
  [HandleDataType.IMAGE]: { hex: "#3B82F6", border: "border-blue-500", bg: "bg-blue-500" },
  [HandleDataType.VIDEO]: { hex: "#22C55E", border: "border-green-500", bg: "bg-green-500" },
  [HandleDataType.AUDIO]: { hex: "#EC4899", border: "border-pink-500", bg: "bg-pink-500" },
  [HandleDataType.FILE]: { hex: "#8B5CF6", border: "border-violet-500", bg: "bg-violet-500" },
  [HandleDataType.ANY]: { hex: "#6B7280", border: "border-gray-500", bg: "bg-gray-500" },
};

export const NODE_TYPES = {
  REQUEST_INPUTS: "request-inputs",
  CROP_IMAGE: "crop-image",
  GEMINI: "gemini",
  RESPONSE: "response",
} as const;

// Model ids must exist on the Google AI Studio free tier; labels match the
// Galaxy.ai reference ("Gemini 3.1 Pro" node).
export const GEMINI_MODELS = [
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
] as const;

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

export const STATUS_COLORS = {
  success: { text: "text-green-700", bg: "bg-green-50 border-green-200", hex: "#22C55E" },
  failed: { text: "text-red-700", bg: "bg-red-50 border-red-200", hex: "#EF4444" },
  partial: { text: "text-amber-700", bg: "bg-amber-50 border-amber-200", hex: "#EAB308" },
  running: { text: "text-blue-700", bg: "bg-blue-50 border-blue-200", hex: "#3B82F6" },
  pending: { text: "text-gray-600", bg: "bg-gray-50 border-gray-200", hex: "#9CA3AF" },
  skipped: { text: "text-amber-700", bg: "bg-amber-50 border-amber-200", hex: "#F59E0B" },
} as const;
