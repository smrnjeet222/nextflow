/**
 * Server-side Transloadit upload used by Trigger.dev tasks to persist
 * generated images (e.g. crop output) and get back a CDN URL instead of
 * shipping base64 blobs through the DB and node edges.
 */

const ASSEMBLY_ENDPOINT = "https://api2.transloadit.com/assemblies";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 20;

function getCredentials() {
  const authKey =
    process.env.TRANSLOADIT_AUTH_KEY ||
    process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY;
  const templateId =
    process.env.TRANSLOADIT_TEMPLATE_ID ||
    process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID;
  return { authKey, templateId };
}

function findFirstResultUrl(assembly: {
  results?: Record<string, Array<{ ssl_url?: string }>>;
  uploads?: Array<{ ssl_url?: string }>;
}): string | null {
  for (const step of Object.values(assembly.results ?? {})) {
    const url = step?.[0]?.ssl_url;
    if (url) return url;
  }
  // Templates without processing steps still expose the raw upload URL
  return assembly.uploads?.[0]?.ssl_url ?? null;
}

/**
 * Uploads a buffer to Transloadit and resolves to its CDN URL.
 * Returns null when credentials are missing or the assembly fails, so callers
 * can fall back to an inline data URL.
 */
export async function uploadBufferToTransloadit(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string | null> {
  const { authKey, templateId } = getCredentials();
  if (!authKey || !templateId) return null;

  try {
    const formData = new FormData();
    formData.append(
      "params",
      JSON.stringify({ auth: { key: authKey }, template_id: templateId })
    );
    formData.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);

    const res = await fetch(ASSEMBLY_ENDPOINT, { method: "POST", body: formData });
    if (!res.ok) {
      console.error(`[transloadit] Assembly creation failed: ${res.status}`);
      return null;
    }

    let assembly = await res.json();
    const pollUrl: string | undefined = assembly.assembly_ssl_url;

    for (
      let attempt = 0;
      attempt < MAX_POLL_ATTEMPTS &&
      (assembly.ok === "ASSEMBLY_EXECUTING" || assembly.ok === "ASSEMBLY_UPLOADING");
      attempt++
    ) {
      if (!pollUrl) break;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const pollRes = await fetch(pollUrl);
      if (!pollRes.ok) break;
      assembly = await pollRes.json();
    }

    if (assembly.ok !== "ASSEMBLY_COMPLETED") {
      console.error(`[transloadit] Assembly did not complete: ${assembly.ok ?? assembly.error}`);
      return null;
    }

    return findFirstResultUrl(assembly);
  } catch (err) {
    console.error("[transloadit] Upload error:", err);
    return null;
  }
}
