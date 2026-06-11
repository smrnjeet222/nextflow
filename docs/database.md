# Database — Neon Postgres + Prisma

## Stack

- **Neon** serverless Postgres — branchable, scale-to-zero, HTTP-friendly driver.
- **Prisma 6** with `@prisma/adapter-neon` + `@neondatabase/serverless` so queries work from serverless/edge-ish runtimes without exhausting connections; `DATABASE_URL` is the pooled connection string, `DIRECT_URL` the direct one (used by schema pushes).
- Schema is managed with **`prisma db push`** — no migrations directory. Deliberate for a fast-iterating trial project: schema-first, no migration ceremony. A production handoff would switch to `prisma migrate` for an auditable history.

## Schema

```prisma
model Workflow {
  id        String   @id @default(cuid())
  userId    String                    // Clerk user id — the tenancy key
  name      String   @default("Untitled Workflow")
  nodes     Json                      // React Flow Node[] snapshot
  edges     Json                      // React Flow Edge[] snapshot
  viewport  Json?                     // { x, y, zoom }
  status    String   @default("idle") // idle | running | completed | failed
  runs      WorkflowRun[]
  @@index([userId])
  @@index([updatedAt])
}

model WorkflowRun {
  id           String    @id @default(cuid())
  workflowId   String
  userId       String
  status       String    @default("running") // pending | running | success | failed | partial
  scope        String                        // full | partial | single
  targetNodes  Json?                         // node ids for partial/single
  triggerRunId String?                       // Trigger.dev parent run id (realtime resubscription)
  duration     Int?
  startedAt    DateTime  @default(now())
  completedAt  DateTime?
  nodeRuns     NodeRun[]
  @@index([workflowId]) @@index([userId]) @@index([startedAt])
}

model NodeRun {
  id           String    @id @default(cuid())
  runId        String
  nodeId       String    // React Flow node id
  nodeName     String
  nodeType     String    // request-inputs | crop-image | gemini | response
  status       String    @default("pending")
  inputs       Json?     // snapshot of resolved inputs
  output       Json?
  error        String?
  duration     Int?
  triggerRunId String?
  startedAt    DateTime?
  completedAt  DateTime?
}
```

## Design decisions

**JSON graph snapshots, not normalized node/edge tables.** The canvas always loads and saves the whole graph atomically — there is no query that wants "all edges where…" across workflows. Normalizing would buy referential integrity nobody consumes and cost a join + reassembly on every load and a diff engine on every save. The *runs* are the queryable, append-only history; the workflow row is a document.

**Runtime state lives in two places, with one writer each.**
- `node.data.output` inside the workflow's `nodes` JSON — the *cached* output used by scoped runs as upstream values.
- `NodeRun` rows — the authoritative per-run record.
Both are written **only by the executor**. The client's autosave strips `status/output/error/duration` before PATCHing, and the PATCH handler re-merges those fields from the DB copy anyway (belt and braces). This single-writer rule is what eliminated the autosave-vs-completion race — see [JOURNEY.md](./JOURNEY.md).

**`triggerRunId` on `WorkflowRun`.** Persisting the Trigger.dev parent run id is what makes *resume after reload* work: the editor finds a pending/running run in its SSR snapshot, re-mints a scoped token, and re-subscribes to the same realtime stream.

**Names denormalized onto `NodeRun`** (`nodeName`, `nodeType`): history must stay readable even after a node is renamed or deleted from the canvas.

**Indexes** follow the read paths: dashboard lists by `userId`/`updatedAt`; history lists by `workflowId`/`startedAt`; the reaper scans by status+`startedAt`.

**Inputs snapshotting.** Each `NodeRun` stores the *resolved* inputs it ran with — debugging a historical run never depends on the current shape of the graph.

## Client access

`src/lib/prisma.ts` exports the usual dev-hot-reload-safe singleton. Server components query Prisma directly (dashboard list, workflow page); API route handlers do the same with `auth()` checks; Trigger.dev tasks import the same client (the tasks' deploy env needs its own `DATABASE_URL`).

## Read-path hygiene

Two patterns worth copying:

- **The workflow page splits its queries**: the graph row is awaited (small, needed for first paint); the runs+nodeRuns query is passed to the client *unawaited* and streamed under Suspense — history size never delays the canvas.
- **The stale-run reaper** (`src/lib/run-reaper.ts`) runs on the run read endpoints, so abandoned `running` rows are corrected by the very polls that would otherwise display them forever.
