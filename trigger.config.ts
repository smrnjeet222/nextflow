import { defineConfig } from "@trigger.dev/sdk";
import { ffmpeg } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_zsmlbmrmpjbggjvxrqio",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    // ffmpeg extension installs the binary on deploy and sets FFMPEG_PATH.
    // Local dev falls back to the ffmpeg-static npm binary (kept external so
    // the bundler never tries to inline it).
    extensions: [
      ffmpeg(),
      // The executor task reads/writes runs through Prisma; the extension
      // generates the client inside the deploy image.
      prismaExtension({ mode: "legacy", schema: "prisma/schema.prisma" }),
    ],
    external: ["ffmpeg-static", "image-size"],
  },
});
