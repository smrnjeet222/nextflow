# React Flow (@xyflow/react v12) — The Canvas

The editor canvas is React Flow v12 with fully custom nodes, edges, and handles. The canvas renders from `flowStore` (Zustand) — React Flow's controlled mode — so undo/redo, autosave, and the run system all observe one source of truth.

## Node catalog

| Node | Type | Notes |
|---|---|---|
| **Request Inputs** | pre-placed, permanent | User-defined fields (`text` / `image`); each field exposes a typed source handle |
| **Crop Image** | addable | Image input handle, percentage crop coordinates, cropped preview on completion |
| **Gemini** | addable | Model dropdown; `Prompt`, `System Prompt`, and multi-connection `Image` target handles |
| **Response** | pre-placed, permanent | Single `any` input; renders final text or image result |

All four share `NodeShell` (header, status ring, per-node run button) and `TypedHandle`.

## Typed handles & connection validation

`TypedHandle` wraps React Flow's `<Handle>` with:

- a **data type** (`text` / `image` / `any`) driving its color (orange / blue / green) — the same palette colors edges;
- solid fill when connected, hollow when free (via `useNodeConnections`);
- a hover tooltip naming the type.

`src/lib/connection-validator.ts` enforces type compatibility at drag time — incompatible source→target pairs are rejected before an edge is created, with `any` accepting everything. The Gemini image handle allows multiple inbound connections; others are single.

### Handle IDs are stable field ids — not names

Request-Inputs handles are keyed `{field.id}:{field.type}`, **not** the field's display name. Renaming a field therefore never breaks existing edges. The executor resolves outputs by both id and name for compatibility. This was a deliberate early decision after realizing rename-breaks-edges is the default failure mode of name-keyed handles.

### The hover-scale lesson

Handles are absolutely positioned by React Flow with a per-side centering transform (e.g. `translate(50%, -50%)` for right handles). Two failed attempts at a hover grow effect:

1. `transform: scale(1.3)` on hover — **clobbers** the translate; the handle jumps position and scales from the wrong origin.
2. The standalone `scale: 1.3` property — composes with `transform` in spec order (scale *before* the transform list), so the centering translate itself gets scaled; origin still wrong.

The correct fix (in `globals.css`): per-side hover rules restating the full transform — `transform: translate(50%, -50%) scale(1.3)` etc. The translate percentages resolve against the unscaled box, so the handle grows from its own center with zero positional drift.

## Edges

`AnimatedEdge` colors itself from the source handle's data type and thickens on hover/selection. While a run is active, edges animate to show data flow direction.

## Undo / redo

`flowStore` keeps `past`/`future` stacks of deep-cloned graph snapshots, capped at 50. Mutating actions push a snapshot; undo/redo shift between stacks. Known accepted residual: snapshots include node runtime fields, so undo can visually resurrect a stale status (harmless — the run ledger guards active runs and autosave strips runtime fields before persisting).

## Viewport persistence & hydration

The viewport (`x`, `y`, `zoom`) persists on the workflow row and round-trips through autosave. Loading order matters:

```tsx
// WorkflowEditor.tsx
const initialGraphRef = useRef({ initialNodes, initialEdges, initialViewport });
useEffect(() => {
  loadWorkflow(...initialGraphRef.current);                   // hydrate store first
  const raf = requestAnimationFrame(() => setCanvasReady(true)); // mount canvas one frame later
  return () => cancelAnimationFrame(raf);
}, [workflowId, loadWorkflow]);
```

Three subtleties, each load-bearing:

- **The ref freezes the mount-time snapshot.** Server re-renders produce new array identities for the same graph; raw props in the dep array would re-fire the effect and wipe unsaved canvas edits with a stale snapshot.
- **The canvas mounts only after the store is hydrated** (`canvasReady` gate), so React Flow picks up the persisted viewport on its very first render instead of flashing the default zoom and jumping.
- **`requestAnimationFrame`** defers the mount one paint frame so store subscribers see hydrated state on their first render; the cleanup cancels it to stay safe under Strict Mode double-invocation and fast navigations.

## Global handle/edge styling

React Flow's stylesheet is imported once; overrides live in `app/globals.css` under `.react-flow__*` selectors (handle size, hover scale per side, connecting/valid colors, edge hover width).
