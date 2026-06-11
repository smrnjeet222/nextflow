# Integrations — Gemini, Transloadit/Uppy, FFmpeg

## Google Gemini (`src/trigger/gemini-llm.ts`)

Text and multimodal generation via `@google/generative-ai`, executed inside a Trigger.dev task (the API key never reaches the client).

- **Model selection** — each Gemini node has a model dropdown; default `gemini-3.1-pro`.
- **Fallback chain** — quota/availability failures fall through `gemini-3.1-pro → gemini-2.5-pro → gemini-2.5-flash` inside the task. The node's output records `modelUsed`, so the history shows which model actually answered.
- **Inputs** — prompt (text handle), optional system prompt (text handle), and an image handle that accepts **multiple** connections for multimodal prompts. Upstream text outputs can be interpolated into prompts.
- **Outputs** — plain text, persisted on the `NodeRun` and cached into `node.data.output` for scoped re-runs.

## Image uploads — Uppy + Transloadit

Two distinct upload paths share `src/lib/transloadit.ts` config:

**1. User uploads (client)** — `src/lib/uppy-upload.ts`. Request-Inputs image fields upload through Uppy's Transloadit plugin (`@uppy/transloadit`), returning a hosted URL stored as the field value. Progress and errors surface per-field in the node UI.

**2. Crop results (task)** — the crop task uploads its FFmpeg output buffer to Transloadit server-side and stores the resulting URL as the node output.

**Fallback** — Transloadit is optional (`isTransloaditConfigured()`): without keys, user images and crop outputs become **base64 data URLs**. Everything keeps working in a keyless dev setup; payloads are just heavier. Allowed types/sizes are validated client-side before upload (`ALLOWED_IMAGE_TYPES`).

Keys: `NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY` + `NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID` (public by design — Transloadit templates are the security boundary; the template restricts what an upload can do).

## FFmpeg (crop task)

- **Dev**: `ffmpeg-static` npm binary.
- **Deployed**: the Trigger.dev **build extension** (`ffmpeg` from `@trigger.dev/build/extensions/core` in `trigger.config.ts`) installs the binary into the worker image and sets `FFMPEG_PATH`; the task prefers the env var and falls back to the static binary.

The crop itself: percentage coordinates from the node UI → pixel box via `image-size` → single `ffmpeg -i input -vf crop=…` invocation → buffer → Transloadit (or data URL). Percentage coordinates were chosen so crops stay valid when a different-sized image flows in.

## Trigger.dev Realtime (client hooks)

`@trigger.dev/react-hooks` provides `useRealtimeRun`, used by `RealtimeRunMonitor` with a **run-scoped public access token** minted by `/api/trigger-token`. The token is scoped to a single run id — the client can subscribe to that run's metadata stream and nothing else. Detailed flow in [trigger-dev.md](./trigger-dev.md#realtime-via-run-metadata).
