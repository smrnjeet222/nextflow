# Next.js 16 — How We Use It

NextFlow runs on the App Router with React Server Components, streaming, and React 19 primitives. This doc explains every framework-level pattern in the codebase and why it's there.

## Rendering strategy

Every user-facing route is **dynamic** (`ƒ` in the build output) because `auth()` from Clerk reads request cookies — there is nothing meaningful to statically prerender for a multi-tenant app. The performance work therefore went into *streaming*, not static generation:

```
Route                 Rendering            Instant feedback from
/dashboard            dynamic SSR          dashboard/loading.tsx (prefetched)
/workflow/[id]        dynamic SSR          workflow/[id]/loading.tsx (prefetched)
```

### The three-layer streaming setup

**Layer 1 — route-level `loading.tsx`.** Both pages have one. On navigation Next.js paints the fallback immediately, then streams the page into it. Each skeleton mirrors its page's real layout (sidebar, top-bar pills, panel frame) so the swap is seamless rather than a spinner flash.

**Layer 2 — `Suspense` around slow queries inside the page.** The dashboard shell (header, sidebar, templates) renders without touching the database; only `<WorkflowList>` queries Prisma, so it sits in its own `Suspense` + error boundary and streams in:

```tsx
// app/dashboard/page.tsx
<WorkflowsBoundary>
  <Suspense fallback={<WorkflowsSkeleton />}>
    <WorkflowList userId={userId} />
  </Suspense>
</WorkflowsBoundary>
```

**Layer 3 — promise props + React 19 `use()`.** The workflow editor needs the graph immediately but the run history only eventually. The page awaits the small workflow query, then passes the *unawaited* runs query to the client:

```tsx
// app/workflow/[id]/page.tsx
const runsPromise = prisma.workflowRun.findMany({ … })   // NOT awaited
return <WorkflowEditor … initialRunsPromise={runsPromise} />
```

```tsx
// WorkflowEditor.tsx (client)
function RunLayer({ initialRunsPromise, … }) {
  const initialRuns = use(initialRunsPromise);   // suspends only this subtree
  …
}
<Suspense fallback={<HistoryPanelSkeleton … />}>
  <RunLayer … />
</Suspense>
```

The canvas and top bar are interactive while history streams. Next.js serializes the promise across the RSC boundary; `use()` unwraps it on the client.

## Navigation & prefetching

**Rule: anything that navigates to a known URL is a `<Link>`, never `router.push`.**

In production, `<Link>` prefetches a dynamic route's static shell — which includes its `loading.tsx` — when the link enters the viewport. That is what makes the loader *instant*: it's already in the client cache before the click. `router.push` prefetches nothing, so the user stares at a frozen page for a full server roundtrip before any feedback appears.

Where each is used:

| Navigation | Method | Reason |
|---|---|---|
| Dashboard card → workflow | `<Link>` | prefetched skeleton |
| Editor back-arrow / home → dashboard | `<Link>` | prefetched skeleton |
| "New workflow" / "Try template" → created workflow | `router.push` after the server action | the destination id doesn't exist until the action returns — nothing to prefetch |

One gotcha: when a card becomes a `<Link>`, interactive elements *inside* it (menu button, dropdown, backdrop) must call `e.preventDefault()` — `stopPropagation()` alone does not stop the anchor's default navigation.

## URL as state

The run-history panel's visibility lives in the URL (`?hide-runs=true`, open by default) via `src/hooks/useUrlState.ts`:

- `useUrlParam(key)` — `[value, setValue]` for any search param.
- `useUrlFlag(key)` — boolean wrapper; `false` removes the param so default-state URLs stay clean.

Writes go through `window.history.replaceState` — Next.js's **shallow routing**. `useSearchParams` subscribers re-render, but no server request fires. Using `router.replace` here would re-render the entire dynamic page on every toggle; `replaceState` (vs `pushState`) also keeps toggles out of back-button history.

## Server actions

The dashboard mutates through server actions (`app/dashboard/actions.ts`): create, create-from-sample, rename, delete. Each action calls `revalidatePath("/dashboard")`, and the client layers `useOptimistic` over the incoming props so rename/delete paint instantly and reconcile (or revert) when the action settles. See [state-management.md](./state-management.md#react-19-on-the-dashboard).

API route handlers (`app/api/*`) remain for things that aren't form-shaped: run polling, execution kickoff, token minting, JSON import/export.

## Middleware

Next 16 renamed the middleware convention — ours lives at **`src/proxy.ts`**, not `middleware.ts`. It wraps `clerkMiddleware` and protects everything except `/sign-in` and `/sign-up`. Details in [auth.md](./auth.md).

## React Compiler

`babel-plugin-react-compiler` is enabled. Components are auto-memoized, which is why the codebase has almost no `useMemo`/`useCallback`/`React.memo` — adding them manually would be noise. The exceptions that remain (e.g. `useCallback` inside `useUrlState`) exist for hook-contract stability, not render performance.

## Transition hygiene

Two `useTransition` lessons baked into the dashboard components:

1. **One transition per concern.** A shared `isPending` across create/rename/delete made the "Create first workflow" button spin when a *delete* was in flight (the optimistic delete reveals the empty state while the action is still pending). Create has its own transition now.
2. **Per-item pending needs an id.** `useTransition` exposes only a boolean — mapping it over a list spins every card. The template grid stores `pendingId` next to the transition and shows the spinner only on `pendingId === sample.id`, while the boolean still disables the whole grid against double imports.

## Error handling

- `app/error.tsx`, `app/global-error.tsx`, `app/dashboard/error.tsx`, `app/workflow/[id]/error.tsx` — route-level boundaries.
- `app/not-found.tsx` — also serves the editor's ownership check (`notFound()` when the workflow doesn't belong to the user, deliberately indistinguishable from a missing id).
