import { WorkflowNode, WorkflowEdge } from "@/types/workflow";

export interface SampleWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export const SAMPLES: SampleWorkflow[] = [
  {
    id: "marketing-banner",
    name: "AI Headphones Marketing Banner Campaign",
    description: "Multi-step workflow that crops product images and uses Gemini to generate marketing copy and social media hooks.",
    nodes: [
      {
        id: "request-inputs-1",
        type: "request-inputs",
        dragging: false,
        measured: { width: 288, height: 386 },
        position: { x: -28.06, y: -101.03 },
        selected: false,
        deletable: false,
        data: {
          type: "request-inputs",
          label: "Request-Inputs",
          fields: [
            {
              id: "text_field",
              name: "text_field",
              type: "text",
              value: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
            },
            {
              id: "image_field",
              name: "image_field",
              type: "image",
              value: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
            },
          ],
        },
      },
      {
        id: "crop-image-1",
        type: "crop-image",
        dragging: false,
        measured: { width: 288, height: 445 },
        position: { x: 405.66, y: -182.89 },
        selected: false,
        data: {
          type: "crop-image",
          label: "Crop Image #1 (Tight Product)",
          cropConfig: { x: 20, y: 20, width: 60, height: 60 },
        },
      },
      {
        id: "crop-image-2",
        type: "crop-image",
        dragging: false,
        measured: { width: 288, height: 445 },
        position: { x: 784.48, y: -226.16 },
        selected: false,
        data: {
          type: "crop-image",
          label: "Crop Image #2 (Wide Banner)",
          cropConfig: { x: 0, y: 0, width: 100, height: 50 },
        },
      },
      {
        id: "gemini-1",
        type: "gemini",
        dragging: false,
        measured: { width: 288, height: 562 },
        position: { x: 411.74, y: 394.95 },
        selected: false,
        data: {
          type: "gemini",
          label: "Gemini #1 (Copywriter)",
          geminiConfig: {
            model: "gemini-3.1-pro",
            prompt: "",
            systemPrompt: "You are a marketing copywriter. Write a one-paragraph product description.",
          },
        },
      },
      {
        id: "gemini-2",
        type: "gemini",
        dragging: false,
        measured: { width: 288, height: 562 },
        position: { x: 800.94, y: 367.13 },
        selected: false,
        data: {
          type: "gemini",
          label: "Gemini #2 (Tweet Hook)",
          geminiConfig: {
            model: "gemini-3.1-pro",
            prompt: "",
            systemPrompt: "Condense the following product description into a tweet-length hook (under 240 characters).",
          },
        },
      },
      {
        id: "gemini-3",
        type: "gemini",
        dragging: false,
        measured: { width: 288, height: 536 },
        position: { x: 1222.12, y: 120.70 },
        selected: false,
        data: {
          type: "gemini",
          label: "Final Gemini (Social Media)",
          geminiConfig: {
            model: "gemini-3.1-pro",
            prompt: "",
            systemPrompt: "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.",
          },
        },
      },
      {
        id: "response-1",
        type: "response",
        dragging: false,
        measured: { width: 288, height: 288 },
        position: { x: 1601.95, y: 244.87 },
        selected: false,
        deletable: false,
        data: { type: "response", label: "Response" },
      },
    ] as WorkflowNode[],
    edges: [
      {
        id: "e-req-img-crop2",
        source: "request-inputs-1",
        target: "crop-image-2",
        animated: false,
        sourceHandle: "image_field:image",
        targetHandle: "imageUrl:image",
        data: { dataType: "image" },
      },
      {
        id: "e-req-txt-gemini1",
        source: "request-inputs-1",
        target: "gemini-1",
        animated: false,
        sourceHandle: "text_field:text",
        targetHandle: "prompt:text",
        data: { dataType: "text" },
      },
      {
        id: "e-gemini1-gemini2",
        source: "gemini-1",
        target: "gemini-2",
        animated: false,
        sourceHandle: "response:text",
        targetHandle: "prompt:text",
        data: { dataType: "text" },
      },
      {
        id: "e-gemini2-gemini3",
        source: "gemini-2",
        target: "gemini-3",
        animated: false,
        sourceHandle: "response:text",
        targetHandle: "prompt:text",
        data: { dataType: "text" },
      },
      {
        id: "e-crop1-gemini3",
        source: "crop-image-1",
        target: "gemini-3",
        animated: false,
        sourceHandle: "outputImageUrl:image",
        targetHandle: "imageUrls:image",
        data: { dataType: "image" },
      },
      {
        id: "e-crop2-gemini3",
        source: "crop-image-2",
        target: "gemini-3",
        animated: false,
        sourceHandle: "outputImageUrl:image",
        targetHandle: "imageUrls:image",
        data: { dataType: "image" },
      },
      {
        id: "e-gemini3-response",
        source: "gemini-3",
        target: "response-1",
        animated: false,
        sourceHandle: "response:text",
        targetHandle: "result:any",
        data: { dataType: "text" },
      },
      {
        id: "e-request-inputs-1-crop-image-1-1781138492445",
        source: "request-inputs-1",
        target: "crop-image-1",
        animated: false,
        sourceHandle: "image_field:image",
        targetHandle: "imageUrl:image",
        data: { dataType: "image" },
      },
    ] as WorkflowEdge[],
    viewport: { x: 204.26, y: 326.68, zoom: 0.64 },
  },
  {
    id: "basic-gemini",
    name: "Basic Gemini Assistant",
    description: "A simple text-in, text-out workflow using Gemini Pro to process user prompts.",
    nodes: [
      {
        id: "request-inputs-1",
        type: "request-inputs",
        position: { x: 0, y: 0 },
        deletable: false,
        data: {
          type: "request-inputs",
          label: "Input",
          fields: [
            { id: "prompt", name: "prompt", type: "text", value: "What are the benefits of using Gemini CLI?" },
          ],
        },
      },
      {
        id: "gemini-1",
        type: "gemini",
        position: { x: 400, y: 0 },
        data: {
          type: "gemini",
          label: "Gemini Pro",
          geminiConfig: {
            model: "gemini-3.1-pro",
            prompt: "",
            systemPrompt: "You are a helpful AI assistant.",
          },
        },
      },
      {
        id: "response-1",
        type: "response",
        position: { x: 800, y: 0 },
        deletable: false,
        data: { type: "response", label: "Output" },
      },
    ] as WorkflowNode[],
    edges: [
      {
        id: "e1",
        source: "request-inputs-1",
        target: "gemini-1",
        sourceHandle: "prompt:text",
        targetHandle: "prompt:text",
        data: { dataType: "text" },
      },
      {
        id: "e2",
        source: "gemini-1",
        target: "response-1",
        sourceHandle: "response:text",
        targetHandle: "result:any",
        data: { dataType: "text" },
      },
    ] as WorkflowEdge[],
    viewport: { x: 100, y: 200, zoom: 1 },
  },
];

export const getSampleWorkflowData = () => SAMPLES[0];
