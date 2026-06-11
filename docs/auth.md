# Authentication — Clerk

## Setup

- `<ClerkProvider>` wraps the app in `src/app/layout.tsx`.
- Catch-all routes `app/sign-in/[[...sign-in]]` and `app/sign-up/[[...sign-up]]` render Clerk's components.
- `UserButton` lives in the dashboard sidebar.

## Middleware — `src/proxy.ts`

Next 16 renamed the middleware file convention; ours is `src/proxy.ts` (not `middleware.ts` — putting it at the old path silently does nothing).

```ts
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();   // unauthenticated → redirect to sign-in
  }
});
```

The matcher skips static assets and `_next`, and always runs for `/api`, `/trpc`, and Clerk's own frontend API routes. Everything except the two auth pages requires a session.

## Per-user data scoping

`userId` (the Clerk user id) is the tenancy key on both `Workflow` and `WorkflowRun`. The rule applied at every data touchpoint:

| Touchpoint | Enforcement |
|---|---|
| Server components | `const { userId } = await auth()` → queries filter by it |
| Workflow page | ownership check → `notFound()` when `workflow.userId !== userId` (indistinguishable from a missing id — no information leak) |
| API route handlers | `auth()` guard at the top; list/mutate queries scoped to `userId` |
| Server actions | same `auth()` guard; ids never trusted without the scope filter |
| Trigger.dev tasks | run on rows already created under the caller's `userId`; the run row carries `userId` for traceability |

Middleware handles *authentication* (is someone signed in); per-query scoping handles *authorization* (is it their data). Both layers are always present — middleware alone is never trusted for data access.

## Implications for rendering

`auth()` reads request cookies, which makes every page dynamic — the documented reason the app's performance strategy is streaming (`loading.tsx` + `Suspense`) rather than static generation. See [nextjs.md](./nextjs.md#rendering-strategy).
