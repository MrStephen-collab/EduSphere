export const materialTypeLabels: Record<string, string> = {
  pdf: "PDF",
  doc: "Word (DOC)",
  docx: "Word (DOCX)",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
  image: "Image",
  audio: "Audio",
  video: "Video",
  link: "External link",
  text: "Text notes",
  other: "File",
};

/**
 * The categories a teacher picks from when attaching something to a lesson.
 * Several map onto the finer `lesson_materials.file_type` values.
 */
export const materialCategories = [
  "document",
  "pdf",
  "video",
  "audio",
  "image",
  "link",
] as const;

export type MaterialCategory = (typeof materialCategories)[number];

export const materialCategoryLabels: Record<MaterialCategory, string> = {
  document: "Document",
  pdf: "PDF",
  video: "Video",
  audio: "Audio",
  image: "Image",
  link: "Link",
};

export const categoryFileTypes: Record<MaterialCategory, string[]> = {
  document: ["doc", "docx", "ppt", "pptx", "text"],
  pdf: ["pdf"],
  video: ["video"],
  audio: ["audio"],
  image: ["image"],
  link: ["link"],
};

export function categoryForFileType(fileType: string | null | undefined): MaterialCategory {
  const type = (fileType ?? "").toLowerCase();
  for (const category of materialCategories) {
    if (categoryFileTypes[category].includes(type)) return category;
  }
  return "document";
}

/**
 * Categories served through an expiring signed URL and rendered without native
 * save controls. Video is hosted externally and audio lives in the private
 * bucket; both are locked down. Everything else stays a plain download.
 */
export const restrictedCategories: readonly MaterialCategory[] = ["video", "audio"];

export function isRestrictedMaterial(
  fileType: string | null | undefined,
): boolean {
  return restrictedCategories.includes(categoryForFileType(fileType));
}

const MB = 1024 * 1024;

/** 50 MB is the bucket's hard limit; video bypasses it via the external host. */
export const maxUploadBytes: Record<MaterialCategory, number> = {
  document: 25 * MB,
  pdf: 50 * MB,
  image: 10 * MB,
  audio: 50 * MB,
  video: 5 * 1024 * MB,
  link: 0,
};

export const categoryAccept: Record<MaterialCategory, string> = {
  document: ".doc,.docx,.ppt,.pptx,.txt,.md,.rtf",
  pdf: ".pdf,application/pdf",
  image: ".png,.jpg,.jpeg,.webp,.gif",
  audio: ".mp3,.m4a,.aac,.ogg,.wav,.mp4",
  video: ".mp4,.mov,.webm,.mkv,.avi",
  link: "",
};

/** MIME allowlist enforced in the browser before anything is uploaded. */
export const categoryMimeTypes: Record<MaterialCategory, string[]> = {
  document: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "text/plain",
    "text/markdown",
    "text/csv",
  ],
  pdf: ["application/pdf"],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  audio: [
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-m4a",
  ],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"],
  link: [],
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}
