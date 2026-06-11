import Uppy from "@uppy/core";
import Transloadit from "@uppy/transloadit";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";

export function isTransloaditConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY &&
      process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID
  );
}

interface AssemblyResultFile {
  ssl_url?: string;
}

interface AssemblyResponse {
  results?: Record<string, AssemblyResultFile[]>;
  uploads?: AssemblyResultFile[];
}

function urlFromAssembly(assembly: AssemblyResponse): string | null {
  for (const step of Object.values(assembly.results ?? {})) {
    const url = step?.[0]?.ssl_url;
    if (url) return url;
  }
  return assembly.uploads?.[0]?.ssl_url ?? null;
}

/**
 * Uploads one image through Uppy's Transloadit plugin and resolves to the
 * resulting CDN URL. Throws when Transloadit isn't configured or the upload
 * fails (callers may fall back to base64).
 */
export function uploadImageViaTransloadit(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const key = process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY;
  const templateId = process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID;
  if (!key || !templateId) {
    return Promise.reject(new Error("Transloadit is not configured"));
  }

  const uppy = new Uppy({
    autoProceed: false,
    restrictions: {
      maxNumberOfFiles: 1,
      allowedFileTypes: ALLOWED_IMAGE_TYPES,
    },
  }).use(Transloadit, {
    waitForEncoding: true,
    assemblyOptions: {
      params: { auth: { key }, template_id: templateId },
    },
  });

  return new Promise<string>((resolve, reject) => {
    const cleanup = () => uppy.destroy();

    uppy.on("upload-progress", (_file, progress) => {
      if (progress.bytesTotal) {
        onProgress?.(Math.round((progress.bytesUploaded / progress.bytesTotal) * 100));
      }
    });

    uppy.on("transloadit:complete", (assembly) => {
      const url = urlFromAssembly(assembly as AssemblyResponse);
      cleanup();
      if (url) resolve(url);
      else reject(new Error("Transloadit assembly returned no file URL"));
    });

    uppy.on("error", (err) => {
      cleanup();
      reject(err);
    });

    uppy.on("restriction-failed", (_file, err) => {
      cleanup();
      reject(err);
    });

    try {
      uppy.addFile({ name: file.name, type: file.type, data: file });
      void uppy.upload();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
