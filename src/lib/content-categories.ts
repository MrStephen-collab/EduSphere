import type { ContentCategory, EducationLevel } from "@/types/database";
import { getLevelDefinition, HIGHER_EDUCATION_LEVELS } from "./education/levels";
import type { MaterialCategory } from "./material-types";

/**
 * What a course or lesson is *made of*, chosen when the teacher sets it up.
 *
 * A course is not only a title and a description: it is delivered as a video
 * series, a slide deck, a recorded lecture, a lab practical, a set of PDFs. That
 * shape is what a student cares about, and until now it was only discoverable
 * after opening the lesson and looking at what had been attached to it.
 *
 * The categories every school may use:
 *
 *   video     a recording
 *   slides    a deck (ppt/pptx)
 *   audio     a recording or podcast
 *   pdf       a document to read or print
 *   document  a worksheet or notes (doc/docx/txt)
 *   image     a diagram, photograph or worksheet image
 *   link      an external resource
 *
 * The categories only a college, polytechnic or university is offered, because
 * they describe post-secondary teaching rather than a format:
 *
 *   lecture     a timetabled teaching session
 *   seminar     a discussion-led session
 *   lab         a practical
 *   project     coursework, capstone or thesis
 *   exam_prep   revision for a particular paper
 *
 * Mirrors the public.content_category enum from 0026_content_categories.sql.
 */
export const CORE_CONTENT_CATEGORIES: readonly ContentCategory[] = [
  "video",
  "slides",
  "audio",
  "pdf",
  "document",
  "image",
  "link",
];

export const HIGHER_ED_CONTENT_CATEGORIES: readonly ContentCategory[] = [
  "lecture",
  "seminar",
  "lab",
  "project",
  "exam_prep",
];

export const CONTENT_CATEGORIES: readonly ContentCategory[] = [
  ...CORE_CONTENT_CATEGORIES,
  ...HIGHER_ED_CONTENT_CATEGORIES,
];

export const contentCategoryLabels: Record<ContentCategory, string> = {
  video: "Video",
  slides: "Slides",
  audio: "Audio",
  pdf: "PDF",
  document: "Document",
  image: "Image",
  link: "Link",
  lecture: "Lecture",
  seminar: "Seminar",
  lab: "Lab / practical",
  project: "Project / thesis",
  exam_prep: "Exam prep",
};

/** One line under the picker, so a teacher knows what the choice means. */
export const contentCategoryDescriptions: Record<ContentCategory, string> = {
  video: "A recorded video lesson.",
  slides: "A presentation deck, PowerPoint or PDF of slides.",
  audio: "An audio recording, podcast or narrated lesson.",
  pdf: "A PDF to read, print or annotate.",
  document: "A worksheet, notes or assignment brief.",
  image: "A diagram, photograph or image worksheet.",
  link: "A link to a resource hosted elsewhere.",
  lecture: "A timetabled teaching session.",
  seminar: "A discussion-led session with a small group.",
  lab: "A practical or laboratory session.",
  project: "Coursework, a capstone or a thesis.",
  exam_prep: "Revision for a particular paper.",
};

export function isContentCategory(value: unknown): value is ContentCategory {
  return typeof value === "string" && (CONTENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The categories offered at this level.
 *
 * A level with no declared level falls back to secondary, which is the same
 * default the rest of the product uses, so a school that has not chosen yet is
 * never offered a category it cannot use.
 */
export function contentCategoriesForLevel(
  level: EducationLevel | null | undefined,
): ContentCategory[] {
  const resolved = getLevelDefinition(level).value;
  return HIGHER_EDUCATION_LEVELS.includes(resolved)
    ? [...CORE_CONTENT_CATEGORIES, ...HIGHER_ED_CONTENT_CATEGORIES]
    : [...CORE_CONTENT_CATEGORIES];
}

export function levelOffersCategory(
  level: EducationLevel | null | undefined,
  category: ContentCategory,
): boolean {
  return contentCategoriesForLevel(level).includes(category);
}

/**
 * The material-upload category a lesson of this kind starts on.
 *
 * Choosing "Video" for a lesson should not then make the teacher pick Video
 * again on the uploader. Categories with no matching upload format fall back to
 * a document, which accepts the widest range of files.
 */
const materialCategoryDefaults: Record<ContentCategory, MaterialCategory> = {
  video: "video",
  slides: "document",
  audio: "audio",
  pdf: "pdf",
  document: "document",
  image: "image",
  link: "link",
  lecture: "document",
  seminar: "document",
  lab: "document",
  project: "document",
  exam_prep: "document",
};

export function materialCategoryForContent(
  category: ContentCategory | null | undefined,
): MaterialCategory {
  return category ? materialCategoryDefaults[category] : "document";
}
