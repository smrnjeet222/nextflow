# JOURNEY — The Build Log

An honest record of how this codebase got here: the messes made along the way, what the review conversations caught, and how each was fixed. Kept because the mistakes are more instructive than the final code.

---

## Phase 1 — The first working version (and its debt)

The first editor that "worked" was a textbook client-state mess, written feature-by-feature without a state model:

- **`WorkflowEditor.tsx` grew to ~397 lines** holding **seven** `useState`/ref pieces of run state: `runs`, `activeRun`, `isSaving`, `isRefreshingRuns`, executing flags, poll interval refs, a resume flag.
- **Fetch-in-`useEffect` everywhere**, no request cache, no dedup — TanStack Query wasn't even installed.
- An **empty-deps "resume run" effect with a `react-hooks/exhaustive-deps` suppression** — the classic sign the data flow is wrong.
- **Two concurrent writers of node runtime state**: the realtime metadata handler and the fallback DB poll (`syncRunFromDb`) free-wrote into node data and **stomped each other**. The recurring symptom: *a node stuck on "running" forever* while the run had actually finished.
- A **handler-registration dance**: deep components needed to trigger runs, so a `runNodeHandler` was registered into flowStore via refs — action-at-a-distance instead of calling a store thunk.
- **Manual `setInterval` polling** that browsers throttle in background tabs — come back to a finished run, UI still says running.
- **Autosave raced the executor**: autosave persisted whole nodes *including runtime fields*, so a save fired mid-run could overwrite the executor's freshly-written outputs with stale client state.
- **No crash path**: an executor throw mid-run left `workflow.status = "running"` in the DB *forever*. No `onFailure`, no reaper.

None of these were typos — they were architecture mistakes: no single owner for any piece of state, and writes flowing in both directions.

## Phase 2 — The state-machine refactor

The fix was planned and landed in reviewable steps, app working after each commit:

```
d67a0e7  Add TanStack Query client and provider
7fa3dbd  Server hardening: executor onFailure, stale-run reaper, PATCH runtime-field merge
b0f9b32  Add runStore FSM and TanStack Query hooks (unwired)
10da1d5  Rewire editor onto runStore FSM and query-driven polling
5b4fe87  flowStore cleanup, NodeShell/TopBar → store thunks
829cc62  Move autosave and rename onto TanStack mutations
b438714  Dashboard: optimistic rename/delete, non-blocking status polling
```

What each mess became:

| Mess | Fix |
|---|---|
| 7 pieces of ad-hoc run state | Discriminated-union FSM (`idle → launching → monitoring → finishing`); illegal transitions no-op |
| Dual writers stomping node status | Monotonic per-run **ledger** — every write through `applyNodeUpdate`, rank can never go backwards, DB is the only output writer |
| Suppressed-deps resume effect | `useWorkflowRun` mount effect dispatching `RESUME`; polling **derives** from phase (`enabled: phase.name === "monitoring"`) — "poll never started" became unrepresentable |
| Throttled background polling | `refetchIntervalInBackground: true` |
| Handler registration refs | Thunks on the store: `useRunStore.getState().startRun(...)` from anywhere |
| Autosave vs executor race | Client strips runtime fields before PATCH; server re-merges them from the DB copy; executor is the sole persisted-runtime writer |
| Stuck `"running"` forever | Executor `onFailure` transaction + 15-min stale-run reaper on the read endpoints |
| Fire-and-forget rename fetch | TanStack mutation |

Decisions reviewed and consciously made, not defaulted into: hand-rolled FSM over XState (4 states don't justify a library; the ledger and declarative polling were the actual fixes), `useOptimistic` on the dashboard but **rejected in the editor** (node state lives in Zustand — mirroring it into React state to use the hook would be cargo-culting), WorkflowEditor shrank ~397 → ~120 lines.

Follow-up in the same era: `fix: optimise autosave` — debounce serialization (never two PATCHes in flight, latest wins).

## Phase 3 — Rendering & async optimisation

With state ownership fixed, the next pass (`feat: add react compiler`, `feat: add loaders and erros`, then the streaming work) modernized how the app *renders and waits*:

**Suspense as the async primitive.** Instead of pages that block on their slowest query, every slow read got its own boundary: the dashboard shell renders database-free while `<WorkflowList>` streams into a `Suspense` under its own error boundary (`WorkflowsBoundary`); the editor's run history streams into `RunLayer`. The unit of loading became "the thing that's actually loading," not the page.

**Loading states that mirror reality.** Route-level `loading.tsx` for both pages plus component-level skeletons (`WorkflowsSkeleton`, `HistoryPanelSkeleton`) — each one a layout-matched copy of the real UI (same pills, same `w-80` panel, same grid), so a resolved boundary swaps in without layout shift. A spinner says "wait"; a skeleton says "here's what's coming."

**Error states at every altitude.** `global-error.tsx` → `error.tsx` → per-route `error.tsx` (dashboard, workflow) → per-section boundary around the workflow list. A failed runs query kills the runs section, not the page. `not-found.tsx` doubles as the ownership check's face — a workflow you don't own 404s identically to one that doesn't exist.

**`async`/`await` stays on the server; `use()` bridges to the client.** Server components await what the first paint needs (auth, the workflow row) and *deliberately don't await* the rest — the runs query crosses the RSC boundary as a serialized promise and is unwrapped with React 19 `use()` inside the client `Suspense`. No `useEffect`-fetch, no loading `useState`, no waterfall: the query starts on the server at request time and the client suspends only the subtree that needs it.

**React Compiler.** `babel-plugin-react-compiler` enabled — components are auto-memoized, so the codebase carries almost no `useMemo`/`useCallback`/`React.memo`. The few `useCallback`s that remain (e.g. inside `useUrlState`) exist for stable hook contracts, not render performance. Net effect: optimization stopped being something written by hand and started being something the compiler proves.

The thread through all five: **stop hand-rolling async UI states.** Loading, errors, and waiting all moved into the framework's declarative slots (`loading.tsx`, `error.tsx`, `Suspense`, `use()`), leaving components to describe only what they look like when data exists.

## Phase 4 — Performance & polish session

A rapid review session. Each item below was a user-reported symptom, the diagnosis, and the fix — including the fixes that were themselves wrong.

### 4.1 Handle hover scaled from the wrong origin — *two wrong fixes before the right one*

**Symptom:** hovering a node connector made it jump position and grow from a corner, not its center.

- **Mistake #1 (pre-existing):** the hover rule was `transform: scale(1.3)` — which *replaces* React Flow's positioning `transform: translate(50%, -50%)`. Scale and jump.
- **Mistake #2 (first fix attempt):** switch to the standalone `scale: 1.3` property, reasoning it composes with `transform`. It does — but in spec order the scale applies *before* the transform list, so the centering translate itself gets scaled. Still wrong origin. User: *"it still scales from 0,0."*
- **Correct fix:** per-side hover rules restating the full transform — `transform: translate(50%, -50%) scale(1.3)` (and the three other sides). Translate percentages resolve against the unscaled box → grows from center, zero drift.

**Lesson:** when overriding a library's transform, restate it — don't try to compose around it.

### 4.2 Production navigation felt slow — loaders not instant

**Symptom (user):** *"when I navigate to a page it should show loader instantly. but it takes time and then loader shows and then content."*

**Diagnosis:** dashboard cards navigated via `router.push` on a plain `<div onClick>` — **zero prefetch**. The click paid a full server roundtrip (Clerk middleware + `auth()` + render start) before *any* pixel changed. `loading.tsx` only helps if it's already in the client cache — which `<Link>` prefetching provides and `router.push` doesn't. The dashboard also had **no `loading.tsx` at all**, so navigating back was just as dead.

**Fix:** cards became `<Link>`s (with `e.preventDefault()` on the nested menu button/dropdown/backdrop — `stopPropagation` alone doesn't stop an anchor's default navigation); created `dashboard/loading.tsx` mirroring the real shell; subsequently the user asked to audit *every* navigation — editor back-arrow and home button also became `<Link>`s. The only surviving `router.push`es are post-server-action redirects to ids that don't exist until the action returns.

**Lesson:** `loading.tsx` without `<Link>` prefetch is a loader you'll never see on time.

### 4.3 Run history blocked the editor page

**Symptom:** workflow page waited on `runs + nodeRuns` (unbounded growth) before rendering anything.

**Fix (user-directed):** split the queries. The page awaits only the small workflow row; the runs query is passed **unawaited** to the client and consumed with React 19 `use()` inside a `Suspense` boundary (`RunLayer`), with a layout-matched `HistoryPanelSkeleton` fallback. Canvas and top bar are interactive while history streams. Accepted trade-off: run-resume after reload starts a few hundred ms later — harmless, polling self-heals.

### 4.4 Panel state: `useState` → URL (then made generic)

User: panel visibility should be URL state (`?hide-runs=true`, open by default). First implementation wrote `URLSearchParams` + `history.replaceState` inline in the editor. The user then asked for it to be **a reusable utility** — extracted `useUrlParam` / `useUrlFlag` (`src/hooks/useUrlState.ts`). Key choice inside: `window.history.replaceState` (Next shallow routing) instead of `router.replace`, which would re-render the dynamic page on every toggle; `replaceState` over `pushState` keeps toggles out of back-button history.

### 4.5 Shared `useTransition` — the same bug, twice

Two symptoms, one root cause: **one pending boolean serving multiple concerns**.

- **Delete → "Create first workflow" spinner.** Deleting the last workflow optimistically revealed the empty state while the delete action was still in flight; the empty state's create button read the *shared* `isPending` and showed a loader nobody asked for. Fix: a dedicated transition for create.
- **One template import → every card spins.** `useTransition` exposes only a boolean; mapped over a grid, every card rendered the spinner. Fix: store `pendingId` alongside; spinner only on the clicked card, the boolean still disables the grid against double-imports.

## Running lessons

1. **Give every piece of state exactly one owner and one writer.** Nearly every hard bug here — stuck statuses, stomped outputs, the autosave race — was two writers and no arbiter.
2. **Make illegal states unrepresentable instead of guarding against them.** The FSM, the ledger, and phase-derived polling each *deleted* a category of bug rather than patching instances of it.
3. **A lint suppression on `exhaustive-deps` is a design smell**, not a lint problem. Both suppressions died with the architecture that needed them.
4. **Effects are for synchronization, not orchestration.** The one honest fetch-in-effect left (autosave debounce) is a write trigger — everything read-shaped lives in queries.
5. **Perceived performance is cache-warming, not server speed.** The server didn't get faster in §4.2; the loader just stopped arriving by carrier pigeon.
6. **Fix the class, not the instance.** The second `useTransition` bug was the first one wearing a different shirt; the URL-state inline code became a hook the moment a second use was conceivable.
7. **Verify before refactoring.** REFACTOR.md cites file:line for every claim; the migration was ordered so the app worked after each commit. Plans you can't verify are vibes.
