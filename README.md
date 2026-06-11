# NextFlow — Open-Source AI Workflow Builder

NextFlow is a full-stack, real-time, DAG-based AI workflow builder that allows developers and creators to design, execute, and monitor complex LLM and image processing pipelines. Featuring an interactive drag-and-drop canvas, concurrent task scheduling, and real-time execution monitoring, NextFlow makes it easy to wire together Google Gemini models, image croppers, and manual inputs into automated workflows.

---

## 🚀 Key Features

* **Interactive Drag-and-Drop Canvas**: Built with `@xyflow/react` (React Flow v12+), complete with a dot-grid background, MiniMap navigation, fit-to-view bounds, and full Undo/Redo history tracking (capped at 50 states).
* **Type-Safe, Color-Coded Connections**: Edges and handles are dynamically color-coded by data type (Orange for Text, Blue for Image, Green for general Outputs/Files). Mismatched connections are visually rejected on the canvas.
* **Concurrent DAG Execution Engine**: An asynchronous orchestrator that topologically sorts nodes, triggers independent sibling branches concurrently, and fans out downstream immediately as parent dependencies resolve without blocking on unrelated siblings.
* **Serverless Task Orchestration**: Powered by Trigger.dev, allowing tasks to run asynchronously without serverless function timeouts. Includes live execution status updates.
* **FFmpeg-Powered Image Processing**: A dedicated image cropping task utilizing `ffmpeg-static` to crop images by percentage coordinates. It features a mandatory 30-second delay to demonstrate background task suspension.
* **Google Gemini AI Integration**: Supports multiple Gemini models (e.g., `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-1.5-pro`) for copywriting and multimodal vision prompts (accepting multiple input images).
* **Comprehensive Run History**: A collapsible right sidebar detailing past executions, duration stats, and expandable trees exposing JSON representations of node-by-node inputs, outputs, and error logs.
* **Import/Export Blueprints**: Download workflow configurations as JSON blueprints and upload them to spawn new canvas projects instantly.
* **User-Scoped Security**: Complete route protection and data isolation using Clerk authentication and Prisma.

---

## 📐 System Architecture

### 1. High-Level Block Diagram
NextFlow operates as a three-tier system: the React client canvas, the Next.js server route handlers, and external serverless APIs.

```mermaid
graph TB
    subgraph Client["Client Browser"]
        A["React Flow Canvas"]
        B["Zustand Store (State + History)"]
        C["Clerk Auth Client"]
        D["Trigger.dev SSE Subscriber"]
    end

    subgraph NextServer["Next.js Server (Next16 App Router)"]
        E["API Route Handlers"]
        F["Clerk Auth Middleware"]
        G["Prisma Client ORM"]
    end

    subgraph CloudRuntime["Cloud Services"]
        H["Neon Serverless PostgreSQL"]
        I["Trigger.dev Task Worker Engine"]
        J["Google Gemini API Studio"]
    end

    A --> B
    A --> C
    A --> D

    A <-->|HTTP REST Requests| E
    E --> F
    E --> G
    G <-->|SQL Connection| H
    E -->|Trigger Jobs| I
    D <-->|SSE Status Streaming| I
    I <-->|Prisma SQL Updates| H
    I -->|Generative Vision Queries| J
```

### 2. DAG Execution Sequence Flow
When a workflow run is initiated, independent parent branches start concurrently at T=0. Child tasks fire immediately as their inputs resolve, fanning out down to the final response node.

```mermaid
sequenceDiagram
    participant Browser as Browser Client
    participant API as Next.js API (/api/execute)
    participant DB as Neon PostgreSQL (Prisma)
    participant Trigger as Trigger.dev Engine
    participant Gemini as Gemini API Studio

    Browser->>API: POST /api/execute { workflowId, scope }
    API->>DB: Create WorkflowRun & NodeRun logs (status: pending)
    API->>Trigger: tasks.trigger("workflow-executor", runId)
    API-->>Browser: Return runId & triggerRunId

    Note over Trigger: workflow-executor begins DAG loop
    Trigger->>DB: Update WorkflowRun status to "running"

    par Concurrent Fan-Out (T=0s)
        Trigger->>Trigger: Run Crop Image #1 (30s FFmpeg delay)
    and
        Trigger->>Trigger: Run Crop Image #2 (30s FFmpeg delay)
    and
        Trigger->>Trigger: Run Gemini #1 (Copywriter prompt)
        Trigger->>Gemini: generateContent(systemInstructions, prompt)
        Gemini-->>Trigger: Text Output (T=4s)
        Trigger->>DB: Update Gemini #1 NodeRun output
    end

    Note over Trigger: Gemini #1 finished -> Fire Gemini #2 immediately (T=4.1s)
    Trigger->>Trigger: Run Gemini #2 (Tweet length hook prompt)
    Trigger->>Gemini: generateContent(tweetInstructions, prompt)
    Gemini-->>Trigger: Text Output (T=8s)
    Trigger->>DB: Update Gemini #2 NodeRun output

    Note over Trigger: Crops complete at T=30.2s. All dependencies for Final Gemini satisfied!
    Trigger->>Trigger: Run Final Gemini (Vision merging Crops #1, #2 + Gemini #2 tweet)
    Trigger->>Gemini: generateContent(multimodalImages, tweetPrompt)
    Gemini-->>Trigger: Final Copy Output (T=34.5s)
    Trigger->>DB: Update Final Gemini NodeRun output

    Trigger->>DB: Update Response NodeRun output
    Trigger->>DB: Update WorkflowRun status to "success"

    Note over Browser: Polling/SSE hook synchronizes Zustand states. Canvas glows pulse off.
```

---

## 🛠️ The 4 Node Types Catalog

1. **Request Inputs (Pre-placed, Permanent)**:
   Exposes a list of fields customizable by type: `text_field` (rich prompt values) or `image_field` (files uploaded via file pickers). Each added field generates a matching typed output handle (`source`) on the right side of the node.
2. **Crop Image (Addable)**:
   Accepts an image input handle. When a connection is made, the manual image text input is disabled. Features percentage coordinate inputs ($X, Y, Width, Height$) and displays a cropped image preview upon completion. Uses a static `ffmpeg-static` binary for image cropping.
3. **Gemini 3.1 Pro (Addable)**:
   Features a model dropdown selector in its header. Exposes target handles for `Prompt`, `System Prompt`, and `Image (Vision)` (which accepts **multiple** concurrent connections for multimodal prompts). Includes a collapsible settings toggle for extra media inputs (video, audio, files) and displays LLM text outputs inline.
4. **Response (Pre-placed, Permanent)**:
   Exposes a single `result` input handle of type `ANY`. It renders either a cropped image thumbnail or a scrollable copy of the final LLM text response once execution completes.

---

## ⚙️ Environment Configuration

NextFlow requires standard configurations for Clerk, Neon Database, Trigger.dev, and Google Gemini. Duplicate `.env.example` as `.env.local` and configure your keys:

```env
# Clerk Authentication (Credentials, matching sign-in/up routes)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Neon PostgreSQL (Database Connection Pooled & Migrations Direct)
DATABASE_URL="postgresql://user:password@ep-xxxxxx.us-east-2.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-xxxxxx.us-east-2.neon.tech/neondb?sslmode=require"

# Trigger.dev API Keys (Task Worker authentication)
TRIGGER_SECRET_KEY=tr_dev_xxxxxxxxxxxxxxxxxxxx

# Google Gemini API Key (Gemini Generative API key)
GOOGLE_AI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx

# Transloadit API Keys (Optional: for image uploads, falls back to Base64)
NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 Running the Project Locally

Follow these steps to run NextFlow on your local machine:

### 1. Install Dependencies
Clone the repository and install the production and developer dependencies:
```bash
npm install
```

### 2. Generate Prisma Client & Migrate Database
Apply the schema migrations to your Neon database and generate the TS client:
```bash
# Generate Prisma Client classes
npx prisma generate

# Create tables in Neon PostgreSQL database
npx prisma db push
```

### 3. Initialize & Start Trigger.dev Tasks
To develop and run the background tasks, you must run the Trigger.dev development server alongside Next.js:
```bash
# Link the workspace to your Trigger.dev account
npx trigger.dev@latest init

# Run the Trigger.dev worker daemon
npx trigger.dev@latest dev
```

### 4. Run the Next.js Development Server
In a separate terminal, launch the Next.js App Router developer server:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser. Unauthenticated visits will redirect to Clerk, and logged-in profiles will access the Dashboard, where the 7-node social banner workflow will automatically seed.

---

## 🏗️ Production Build Verification
To ensure everything compiles with zero warnings or type errors before deploying, run:
```bash
# TypeScript strict compile dry-run
npx tsc --noEmit

# Compile Next.js production bundle
npm run build
```
