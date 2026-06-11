import { schemaTask, wait, logger } from "@trigger.dev/sdk";
import { z } from "zod";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { DEFAULT_GEMINI_MODEL } from "../lib/constants";

const GeminiPayloadSchema = z.object({
  model: z.string().min(1).default(DEFAULT_GEMINI_MODEL),
  prompt: z.string().min(1, "Prompt is required"),
  systemPrompt: z.string().optional(),
  imageUrls: z.array(z.string()).optional(), // Vision (URLs or base64 data URIs)
});

// Tried in order when the requested model isn't usable on the API key.
// Flash models are the ones with meaningful free-tier quota (pro models
// report "limit: 0" on free keys). The model actually used is returned in
// the output so a fallback is never silent.
const MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

/** Max in-task waits per model when Google asks us to retry later. */
const MAX_RATE_LIMIT_WAITS = 2;
const MAX_RETRY_DELAY_SECONDS = 120;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isModelUnavailableError(message: string): boolean {
  return /not found|is not supported|permission|404/i.test(message);
}

function isRateLimitError(message: string): boolean {
  return /429|Too Many Requests|RESOURCE_EXHAUSTED|quota/i.test(message);
}

/** "limit: 0" means the key has zero quota for this model — waiting never helps. */
function isZeroQuotaError(message: string): boolean {
  return /limit:\s*0\b/i.test(message);
}

/** Google embeds "Please retry in 53.5s." in 429 bodies. */
function parseRetryDelaySeconds(message: string): number | null {
  const match = message.match(/retry in\s+([\d.]+)\s*s/i);
  return match ? Math.ceil(parseFloat(match[1])) : null;
}

async function toImagePart(url: string): Promise<Part | null> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      logger.warn("Skipping malformed data URL image");
      return null;
    }
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return { inlineData: { mimeType, data: buffer.toString("base64") } };
  } catch (err) {
    logger.error("Failed to fetch vision image", { url, err: String(err) });
    return null;
  }
}

export const geminiLlmTask = schemaTask({
  id: "gemini-llm",
  schema: GeminiPayloadSchema,
  // Free-tier Gemini RPM is very low; cap concurrent calls across the whole
  // project so parallel Gemini nodes queue instead of bursting into 429s.
  queue: { concurrencyLimit: 2 },
  // Rate limits are handled in-task with precise waits; a blind task-level
  // retry would just replay the same 429.
  retry: { maxAttempts: 1 },
  run: async (payload) => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const parts: Part[] = [{ text: payload.prompt }];
    for (const url of payload.imageUrls ?? []) {
      if (!url) continue;
      const part = await toImagePart(url);
      if (part) parts.push(part);
    }

    logger.info("Calling Gemini", {
      model: payload.model,
      promptLength: payload.prompt.length,
      imageCount: parts.length - 1,
    });

    const candidates = [payload.model, ...MODEL_FALLBACKS.filter((m) => m !== payload.model)];
    let lastError: unknown;

    for (const modelName of candidates) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(payload.systemPrompt ? { systemInstruction: payload.systemPrompt } : {}),
      });

      for (let attempt = 0; attempt <= MAX_RATE_LIMIT_WAITS; attempt++) {
        try {
          const result = await model.generateContent({ contents: [{ role: "user", parts }] });
          const responseText = result.response.text();

          if (modelName !== payload.model) {
            logger.warn("Requested model unavailable, used fallback", {
              requested: payload.model,
              used: modelName,
            });
          }
          logger.info("Gemini responded", { model: modelName, responseLength: responseText.length });
          return { response: responseText, modelUsed: modelName };
        } catch (err) {
          lastError = err;
          const message = errorMessage(err);

          if (isModelUnavailableError(message)) {
            logger.warn("Model unavailable, trying next fallback", { model: modelName });
            break; // next candidate model
          }

          if (isRateLimitError(message)) {
            if (isZeroQuotaError(message)) {
              // Key has no quota for this model at all — waiting is pointless
              logger.warn("Model has zero free-tier quota, trying next fallback", {
                model: modelName,
              });
              break; // next candidate model
            }

            if (attempt < MAX_RATE_LIMIT_WAITS) {
              const delay = Math.min(
                (parseRetryDelaySeconds(message) ?? 30) + 2, // +2s safety margin
                MAX_RETRY_DELAY_SECONDS
              );
              logger.warn("Rate limited, waiting before retry", {
                model: modelName,
                delaySeconds: delay,
                attempt: attempt + 1,
              });
              // wait.for checkpoints the run — no compute burned while waiting
              await wait.for({ seconds: delay });
              continue; // retry same model
            }

            logger.warn("Rate limit retries exhausted, trying next fallback", {
              model: modelName,
            });
            break; // next candidate model
          }

          throw err; // genuine error (bad request, auth, etc.) — fail the node
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  },
});
