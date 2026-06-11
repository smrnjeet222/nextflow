# Trigger.dev v4 — Durable Workflow Execution

All workflow execution happens in Trigger.dev tasks (`src/trigger/`), not in Next.js route handlers. Route handlers create DB rows and trigger tasks; tasks do the work, write results to Postgres, and stream progress back.

**Why Trigger.dev at all:** a workflow run can take minutes (the crop task alone has a mandatory 30-second delay). Serverless functions time out; Trigger.dev runs are durable, checkpointable, observable, and retryable, and its Realtime API gives us live progress without running any socket infrastructure.

## The tasks

| Task | File | Purpose |
|---|---|---|
| `workflow-executor` | `workflow-executor.ts` | Orchestrates an entire run: DAG scheduling, node dispatch, status persistence |
| `crop-image` | `crop-image.ts` | FFmpeg percentage crop + 30 s checkpointed delay + Transloadit upload |
| `gemini-llm` | `gemini-llm.ts` | Gemini text/vision generation with a model fallback chain |

All are `schemaTask`s — payloads are validated with Zod at the task boundary.

## The executor: a per-node promise DAG

The heart of the system. For each run:

1. Load the workflow + run rows; mark both `running`.
2. Topologically sort the graph (`src/lib/dag.ts`) — also rejects cycles.
3. Build **one promise per node**, where each node's promise `await`s all of its parents' promises before executing. Then `await Promise.all(leaves)`.

This shape gives maximal concurrency for free: independent branches start at T=0 simultaneously; a child fires the *instant* its last parent resolves, regardless of unrelated siblings still running. There is no "level by level" batching.

Failure semantics: a failed parent doesn't throw through the graph — children of a failed/skipped parent resolve as `skipped`, the rest of the DAG keeps going, and the run ends `partial`/`failed` accordingly.

**Why not `triggerAndWait` per node:** v4 wait checkpoints cannot run under concurrent promise fan-out (`Promise.all` of waits is not checkpoint-safe), and per-node child runs would add a cold start per node. Node work that needs durability (the crop delay) is its own task; the executor calls node logic directly otherwise.

### Scoped runs

`scope: "full" | "partial" | "single"`. For partial/single runs only the target nodes execute — upstream *values* come from each node's cached `node.data.output` persisted on the workflow row (request-inputs nodes resolve live so fresh user input is always honored). This is what makes the per-node "Run" button cheap.

### Realtime via run metadata

The executor publishes per-node progress as run metadata, kept deliberately tiny:

```ts
metadata.set(`node:${nodeId}`, { status, error?, duration? });
```

Wrapped in try/catch — metadata only works inside a run context, and realtime must never kill execution.

The client flow:

1. `/api/execute` returns the `triggerRunId` (also persisted on `WorkflowRun` for resume-after-reload).
2. The client mints a **run-scoped public token** via `/api/trigger-token`.
3. `RealtimeRunMonitor` subscribes with `useRealtimeRun(triggerRunId, { accessToken })` and forwards `node:*` metadata entries into the runStore ledger as *status hints* (never outputs — see [state-management.md](./state-management.md)).

Token minting is best-effort: if it fails, the FSM stays in `monitoring` and DB polling (2 s) carries the run alone. Realtime is an enhancement, not a dependency.

## Crash safety

Two layers ensure a run can never stay "running" forever:

1. **`onFailure` lifecycle hook** on the executor (retries are capped at 1 attempt, so it fires on first failure): one transaction marks the run `failed`, all pending/running nodeRuns `failed` with an "executor crashed" error, and the workflow `idle`.
2. **Stale-run reaper** (`src/lib/run-reaper.ts`), invoked from the run read endpoints: any run still pending/running with `startedAt` older than 15 minutes gets the same treatment and the corrected row is returned. Since the client polls those endpoints anyway, stuck runs self-heal in the UI with zero extra round-trips and no cron.

## The crop task

- **Mandatory 30 s `wait.for({ seconds: 30 })`** — a spec requirement, and a deliberate demonstration of durable waits: the run checkpoints, frees the worker, and resumes.
- FFmpeg from `FFMPEG_PATH` in deployment (set by the build extension), falling back to `ffmpeg-static` in dev.
- Crop box arrives as percentage coordinates; `image-size` resolves pixel values.
- Output uploads to Transloadit; if unconfigured, falls back to a base64 data URL.

## The Gemini task

Default model `gemini-3.1-pro` with an in-task fallback chain → `gemini-2.5-pro` → `gemini-2.5-flash` (quota/availability errors trigger the next model; the result records `modelUsed`). Accepts a prompt, optional system prompt, and **multiple** image inputs for vision.

## Build configuration (`trigger.config.ts`)

- `runtime` matched to the Node version Next.js runs on (a deploy/dev mismatch bit us once).
- FFmpeg build extension (`ffmpeg` from `@trigger.dev/build/extensions/core`) provides the binary in deployed workers and sets `FFMPEG_PATH`.
- `prisma` client generation handled so tasks can import `src/lib/prisma`.

Deploy: `npx trigger.dev@4 deploy`, with `DATABASE_URL`, `GOOGLE_AI_API_KEY`, and `TRANSLOADIT_*` set in the Trigger.dev environment (task env is separate from Vercel env — forgetting this is the classic deploy failure).
