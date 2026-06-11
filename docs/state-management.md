# State Management — Zustand FSM + TanStack Query

The state layer is split by *who owns the truth*:

| Kind of state | Owner | Examples |
|---|---|---|
| Graph (document) state | `flowStore` (Zustand) | nodes, edges, viewport, undo/redo history |
| Run lifecycle | `runStore` (Zustand FSM) | which run is active, what phase it's in |
| Node runtime state | `runStore` ledger → rendered via `flowStore` node data | per-node status/output/error/duration |
| Server state | TanStack Query | runs list, run detail, save/rename mutations |
| Pure UI state | `useState` / URL params | modals, search text, `?hide-runs` |

This split is the product of the project's biggest refactor — the original editor kept all of it in 7 `useState`/ref pieces inside one 397-line component. See [JOURNEY.md](./JOURNEY.md#the-state-machine-refactor) for the full story.

## flowStore — the document

`src/stores/flowStore.ts` owns what the user *edits*: nodes, edges, viewport, plus undo/redo as deep-cloned snapshots capped at 50. It knows nothing about runs. Components mutate it through actions (`updateNodeData`, `loadWorkflow`, `undo`, `redo`, …), and the canvas renders directly from it.

## runStore — the run lifecycle FSM

`src/stores/runStore.ts` models the run lifecycle as a discriminated union:

```ts
type RunPhase =
  | { name: "idle" }
  | { name: "launching"; scope: RunScope; targetIds: string[] | null }
  | { name: "monitoring"; runId: string; triggerRunId: string; token: string | null; resumed: boolean }
  | { name: "finishing"; runId: string };
```

Events: `START`, `LAUNCHED`, `LAUNCH_FAILED`, `TOKEN_MINTED`, `RESUME`, `RUN_COMPLETED`, `FINISHED`. A small `transition()` helper ignores (and `console.warn`s) illegal transitions — e.g. `START` while not idle simply no-ops, which *is* the double-click guard. `isExecuting` is derived (`phase.name !== "idle"`), never stored.

**Why a hand-rolled FSM and not XState:** one machine, four states, seven events, no nesting/actors/timers. The bugs that motivated the refactor (dual writers, stale overwrites, polls that never started) are solved by the ledger and declarative polling below — which XState doesn't provide. Zero added dependency.

### The monotonic ledger — taming three writers

Node runtime state has three legitimate writers with different latencies:

1. **Optimistic** — `startRun` seeds in-scope nodes to `pending` instantly.
2. **Realtime** — Trigger.dev metadata pushes status/error/duration *hints*.
3. **DB poll** — the run-detail query ingests authoritative statuses **and outputs**.

Before the refactor, realtime and polling overwrote each other freely ("node stuck on running" was the recurring bug). Now every write funnels through `applyNodeUpdate(nodeId, update, source)`, guarded by a per-run rank ledger:

```
idle (0) < pending (1) < running (2) < success/failed/skipped (3)
```

A write that would *downgrade* a node's rank within a run is dropped. DB wins terminal ties. The ledger resets on `START`/`RESUME` (on resume it's seeded from the snapshot's `nodeRuns`, so already-finished nodes are rank-locked against stale realtime replays).

Two hard rules fall out of this:

- **Only the DB ingest writes outputs.** Realtime physically can't (outputs live in the DB) and shouldn't try.
- **Stale-overwrite bugs are now unrepresentable**, not merely fixed — overlapping refetches and late realtime frames are absorbed by idempotent, monotonic ingestion.

### Thunks live on the store

Components call `useRunStore.getState().startRun("single", [id])` directly — no prop-drilled handlers, no handler-registration refs (the old code registered a `runNodeHandler` into flowStore so deep children could trigger runs; deleted).

- `startRun` — `START` guard → optimistic pending → `POST /api/execute` → `LAUNCHED` → invalidate runs list → best-effort realtime token mint. Any failure → `LAUNCH_FAILED` + rollback of the optimistic statuses.
- `runCompleted` — → `finishing` → one final `fetchQuery` of run detail as reconcile → invalidate runs list → `FINISHED`. If the reconcile throws we still go idle — never strand the UI on "Running…".
- `ingestRunDetail` — writes every nodeRun through the ledger; a terminal run status dispatches `RUN_COMPLETED` (idempotent — poll and realtime race to fire it; the loser no-ops).
- `applyRealtimeStates` — status hints only; a node newly turning terminal nudges the run-detail query to refetch (coalesced).

## TanStack Query — the server-state layer

`src/lib/queries.ts` + `src/lib/query-client.ts` (browser-singleton / per-request-on-server `getQueryClient()` pattern, provider mounted in the root layout).

| Query/Mutation | Design |
|---|---|
| `useRunsQuery(workflowId, initialRuns)` | `initialData` from the SSR snapshot, `staleTime` 15s, **no polling interval**. Invalidated exactly twice per run (launch + completion) plus the manual refresh button (`refetch()`; `isFetching` drives its spinner) |
| `useRunDetailQuery()` | `enabled` derives from FSM phase (`monitoring`/`finishing`); `refetchInterval` 2s without a realtime token, relaxed to 4s with one; **`refetchIntervalInBackground: true`** so backgrounded tabs keep reconciling; the `queryFn` itself calls `runStore.ingestRunDetail` — fetching and ingesting are one atomic step |
| `useSaveWorkflowMutation` | PATCH `{nodes, edges, viewport}` |
| `useRenameWorkflowMutation` | replaces an old fire-and-forget `fetch` |

**Polling is declarative.** The query's `enabled` flag is *computed from* the FSM phase, so "the poll never started" — an entire class of effect-ordering bug — cannot be expressed. Compare the old model: a `useEffect` with an empty dep array, a lint suppression, and a manually managed `setInterval` that browsers throttle in background tabs.

## Autosave — `useAutosave(workflowId)`

A 1200 ms debounce timer effect on `[nodes, edges, viewport]` feeding the save mutation. This is the codebase's one honest "fetch in an effect" — it's a *write trigger*, not a data dependency. Specifics:

- If a PATCH is already in flight when the timer fires, re-arm 300 ms — saves are serialized, latest-wins, never two in flight.
- The payload passes through `stripRuntimeNodeState` so `status/output/error/duration` **never leave the client** — the executor is the sole writer of persisted runtime state (the server's PATCH handler enforces the same rule by merging runtime fields from the DB copy; belt and braces).
- Returns `isSaving` for the top-bar indicator.

## React 19 on the dashboard

`useOptimistic(workflows, reducer)` layers instant rename/delete over server actions + `revalidatePath`. The reducer applies the local change; when the transition settles, the canonical list reconciles (or reverts on failure). The status poll (`router.refresh` on an interval) is wrapped in `startTransition` so it never flashes pending UI.

**Where `useOptimistic` was rejected:** the editor. Node statuses live in Zustand, not React-owned state — the FSM's `launching` phase + optimistic pending + `LAUNCH_FAILED` rollback *is* the optimistic pattern, implemented where the state actually lives. Using the hook there would have meant mirroring store state into React state purely to satisfy the API.

## Known accepted residual

Undo snapshots clone runtime fields, so undo can visually resurrect a stale status. The ledger prevents corruption of an *active* run and the autosave strip prevents persistence; excluding runtime fields from `cloneGraph` is the clean future fix.
