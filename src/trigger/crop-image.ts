import { schemaTask, wait, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import { execFile } from "child_process";
import util from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { imageSize } from "image-size";

const execFilePromise = util.promisify(execFile);

const CropImagePayloadSchema = z.object({
  imageUrl: z.string().min(1, "No image URL provided for cropping"),
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  w: z.number().min(0).max(100),
  h: z.number().min(0).max(100),
});

async function resolveFfmpegPath(): Promise<string> {
  // Deploy: the ffmpeg() build extension installs the binary and sets FFMPEG_PATH.
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // Dev: fall back to the ffmpeg-static npm binary.
  const ffmpegStatic = (await import("ffmpeg-static")).default;
  if (!ffmpegStatic) throw new Error("No ffmpeg binary available (FFMPEG_PATH unset, ffmpeg-static missing)");
  return ffmpegStatic;
}

async function fetchImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Malformed data URL for input image");
    return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${imageUrl}: ${response.status} ${response.statusText}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "image/jpeg",
  };
}

export const cropImageTask = schemaTask({
  id: "crop-image",
  schema: CropImagePayloadSchema,
  retry: { maxAttempts: 1 }, // the 30s mandatory delay makes retries expensive; fail fast
  run: async (payload) => {
    logger.info("Crop task started", { ...payload, imageUrl: payload.imageUrl.slice(0, 120) });

    // Mandatory 30+ second artificial delay (hard project requirement).
    // wait.for checkpoints the run instead of burning compute on a setTimeout.
    await wait.for({ seconds: 30 });
    logger.info("30-second mandatory delay completed, cropping...");

    const { buffer, mimeType } = await fetchImage(payload.imageUrl);

    const dimensions = imageSize(buffer);
    if (!dimensions.width || !dimensions.height) {
      throw new Error("Could not determine image dimensions");
    }

    // Percentages → pixels. Position may be negative (rect starting off-canvas):
    // the crop becomes the intersection of the requested rect and the image.
    const desiredX = Math.round((payload.x / 100) * dimensions.width);
    const desiredY = Math.round((payload.y / 100) * dimensions.height);
    const desiredW = Math.round((payload.w / 100) * dimensions.width);
    const desiredH = Math.round((payload.h / 100) * dimensions.height);

    const cropX = Math.min(dimensions.width - 1, Math.max(0, desiredX));
    const cropY = Math.min(dimensions.height - 1, Math.max(0, desiredY));
    const cropW = Math.max(1, Math.min(dimensions.width, desiredX + desiredW) - cropX);
    const cropH = Math.max(1, Math.min(dimensions.height, desiredY + desiredH) - cropY);

    const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
    const tempDir = os.tmpdir();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = path.join(tempDir, `crop-input-${stamp}${ext}`);
    const outputPath = path.join(tempDir, `crop-output-${stamp}${ext}`);

    try {
      await fs.promises.writeFile(inputPath, buffer);

      const ffmpegPath = await resolveFfmpegPath();
      logger.info("Running ffmpeg crop", {
        src: `${dimensions.width}x${dimensions.height}`,
        rect: `${cropW}x${cropH}+${cropX}+${cropY}`,
      });

      await execFilePromise(ffmpegPath, [
        "-y",
        "-i", inputPath,
        "-vf", `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
        outputPath,
      ]);

      const croppedBuffer = await fs.promises.readFile(outputPath);

      // Data URL keeps the result permanently viewable: Transloadit assembly
      // URLs live on temporary storage and expire after ~24h, breaking
      // previews on reload. Crops are small enough to inline.
      const outputImageUrl = `data:${mimeType};base64,${croppedBuffer.toString("base64")}`;

      logger.info("Crop complete", { bytes: croppedBuffer.length });
      return { outputImageUrl };
    } finally {
      await Promise.allSettled([
        fs.promises.unlink(inputPath),
        fs.promises.unlink(outputPath),
      ]);
    }
  },
});
