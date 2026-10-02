"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookPlus,
  ChevronDown,
  Eye,
  FilePlus2,
  FolderPlus,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createCourseAction,
  createLessonAction,
  createMaterialAction,
  createModuleAction,
  deleteCourseAction,
  deleteLessonAction,
  deleteModuleAction,
  setCourseStatusAction,
  setLessonStatusAction,
  updateCourseAction,
  updateLessonAction,
  type ActionState,
} from "@/app/teacher/actions";
import { refreshVideoMaterialAction } from "@/app/teacher/material-actions";
import type { ContentStatus } from "@/types/database";
import { materialTypeLabels } from "@/lib/material-types";

export function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

function nativeSelectClass() {
  return "h-9 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

function fieldLabelClass() {
  return "text-sm font-medium";
}

function textareaClass() {
  return "w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export type SelectOption = { id: string; name: string };

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function CourseCreateForm({
  subjects,
  classes,
}: {
  subjects: SelectOption[];
  classes: SelectOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createCourseAction({
            title: title.trim(),
            description: description.trim() || null,
            subjectId: subjectId || null,
            classId: classId || null,
            status,
          });
          if (result.ok && result.id) {
            setTitle("");
            setDescription("");
            setSubjectId("");
            setClassId("");
            router.push(`/teacher/courses/${result.id}`);
            router.refresh();
          } else if (!result.ok) {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <BookPlus className="size-5 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Create a new course</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="crs-title" className={fieldLabelClass()}>
          Course title
        </Label>
        <Input
          id="crs-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. SS2 Mathematics"
          required
          minLength={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="crs-subject" className={fieldLabelClass()}>
            Subject
          </Label>
          <select id="crs-subject" className={nativeSelectClass()} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="crs-class" className={fieldLabelClass()}>
            Class
          </Label>
          <select id="crs-class" className={nativeSelectClass()} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="crs-desc" className={fieldLabelClass()}>
          Description (optional)
        </Label>
        <textarea
          id="crs-desc"
          className={textareaClass()}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will students learn?"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="crs-status" className={fieldLabelClass()}>
          Status
        </Label>
        <select id="crs-status" className={nativeSelectClass()} value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Drafts are only visible to editors. Publish when ready for students.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {isPending ? "Creating…" : "Create course"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function CourseEditorForm({
  courseId,
  initialTitle,
  initialDescription,
  initialSubjectId,
  initialClassId,
  subjects,
  classes,
}: {
  courseId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialSubjectId: string | null;
  initialClassId: string | null;
  subjects: SelectOption[];
  classes: SelectOption[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await updateCourseAction(courseId, {
            title: title.trim(),
            description: description.trim() || null,
            subjectId: subjectId || null,
            classId: classId || null,
          });
          if (result.ok) setSaved(true);
          else setError(result.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="crs-title" className={fieldLabelClass()}>
          Course title
        </Label>
        <Input id="crs-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className={fieldLabelClass()}>Subject</Label>
          <select className={nativeSelectClass()} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabelClass()}>Class</Label>
          <select className={nativeSelectClass()} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className={fieldLabelClass()}>Description</Label>
        <textarea className={textareaClass()} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function CourseStatusToggle({
  courseId,
  status,
  compact,
}: {
  courseId: string;
  status: ContentStatus;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const published = status === "published";

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "sm" : "sm"}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setCourseStatusAction(courseId, published ? "draft" : "published");
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : published ? (
          <Eye className="size-3.5" aria-hidden="true" />
        ) : (
          <Eye className="size-3.5" aria-hidden="true" />
        )}
        {published ? "Unpublish" : "Publish"}
      </Button>
    </span>
  );
}

export function CourseDeleteButton({ courseId }: { courseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm("Delete this course? Its lessons stay in the database but are hidden from students.")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteCourseAction(courseId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
        Delete
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export function ModuleCreateForm({ courseId, onCreated }: { courseId: string; onCreated?: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createModuleAction({
            courseId,
            title: title.trim(),
            description: description.trim() || null,
          });
          if (result.ok) {
            setTitle("");
            setDescription("");
            onCreated?.();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-48 flex-1 gap-1.5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Module name, e.g. Quadratic Equations"
            aria-label="Module name"
            required
            minLength={2}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <FolderPlus className="size-3.5" aria-hidden="true" />}
          {isPending ? "Adding…" : "Add module"}
        </Button>
      </div>
      {description || title ? (
        <textarea
          className={textareaClass()}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional module description"
        />
      ) : null}
      <FieldError error={error} />
    </form>
  );
}

export function ModuleCard({
  moduleId,
  courseId,
  title,
  description,
  lessonCount,
  children,
}: {
  moduleId: string;
  courseId: string;
  title: string;
  description: string | null;
  lessonCount: number;
  children?: React.ReactNode;
}) {
  // Open by default. It used to start closed, which meant the server rendered no
  // lesson links at all -- every lesson, and with it the only route to a lesson's
  // video upload, was inside a panel that did not exist until some JavaScript ran.
  // A teacher landing here with JavaScript slow or disabled saw a course page
  // that looked empty, and no lesson links to follow.
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          <span className="truncate font-medium">{title}</span>
          <Badge variant="secondary" className="shrink-0">
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          </Badge>
        </button>
        <span className="flex shrink-0 items-center gap-1">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete module ${title}`}
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Delete this module? Lessons inside move to the unorganised section.")) return;
              setError(null);
              startTransition(async () => {
                const result = await deleteModuleAction(moduleId, courseId);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
          </Button>
        </span>
      </div>
      {description ? <p className="px-4 pb-2 text-sm text-muted-foreground">{description}</p> : null}
      {open && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export function LessonCreateForm({
  courseId,
  moduleId,
  defaultOpen,
}: {
  courseId: string;
  moduleId?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="grid gap-2">
      {!open && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <FilePlus2 className="mr-1 size-3.5" aria-hidden="true" />
          Add lesson
        </Button>
      )}
      {open && (
        <form
          className="grid gap-2 rounded-md border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await createLessonAction({
                courseId,
                moduleId,
                title: title.trim(),
                status,
              });
              if (result.ok && result.id) {
                setTitle("");
                setOpen(false);
                router.push(`/teacher/courses/${courseId}/lessons/${result.id}`);
                router.refresh();
              } else if (!result.ok) {
                setError(result.error);
              }
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="les-title" className={fieldLabelClass()}>
              Lesson title
            </Label>
            <Input
              id="les-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Quadratic Equations"
              required
              minLength={2}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className={nativeSelectClass() + " max-w-36"} value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)} aria-label="Lesson status">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
              {isPending ? "Creating…" : "Create lesson"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <FieldError error={error} />
          </div>
        </form>
      )}
    </div>
  );
}

export function LessonEditForm({
  lessonId,
  courseId,
  initial,
  modules,
}: {
  lessonId: string;
  courseId: string;
  initial: {
    title: string;
    description: string | null;
    content: string | null;
    videoUrl: string | null;
    moduleId: string | null;
    status: ContentStatus;
  };
  modules: { id: string; title: string }[];
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [content, setContent] = useState(initial.content ?? "");
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");
  const [moduleId, setModuleId] = useState(initial.moduleId ?? "");
  const [status, setStatus] = useState<ContentStatus>(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await updateLessonAction(lessonId, courseId, {
            title: title.trim(),
            description: description.trim() || null,
            content: content.trim() || null,
            videoUrl: videoUrl.trim() || null,
            moduleId: moduleId || null,
          });
          if (result.ok) setSaved(true);
          else setError(result.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="les-title" className={fieldLabelClass()}>
          Lesson title
        </Label>
        <Input id="les-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className={fieldLabelClass()}>Module</Label>
          <select className={nativeSelectClass()} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">No module</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabelClass()}>Status</Label>
          <select className={nativeSelectClass()} value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="les-video" className={fieldLabelClass()}>
          Video link (YouTube)
        </Label>
        <Input
          id="les-video"
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
        <p className="text-xs text-muted-foreground">
          Paste any YouTube link; it will be embedded on the student lesson page.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="les-desc" className={fieldLabelClass()}>
          Short description
        </Label>
        <Input id="les-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One-line summary shown in lists" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="les-content" className={fieldLabelClass()}>
          Lesson notes
        </Label>
        <textarea
          id="les-content"
          className={textareaClass()}
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"Write the lesson body here.\n\nPlain text is rendered with line breaks, and simple markers are supported:\n\n## Heading\n- bullet point\n1. numbered step\n**bold text**"}
        />
        <p className="text-xs text-muted-foreground">
          Lightweight formatting: ## headings, - bullets, 1. numbered lists, **bold**.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {isPending ? "Saving…" : "Save lesson"}
        </Button>
        <LessonStatusToggle lessonId={lessonId} courseId={courseId} status={status} />
        {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
        <FieldError error={error} />
      </div>
    </form>
  );
}

export function LessonStatusToggle({
  lessonId,
  courseId,
  status,
}: {
  lessonId: string;
  courseId: string;
  status: ContentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const published = status === "published";

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setLessonStatusAction(lessonId, courseId, published ? "draft" : "published");
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
        {published ? "Unpublish" : "Publish"}
      </Button>
    </span>
  );
}

export function LessonDeleteButton({ lessonId, courseId }: { lessonId: string; courseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm("Delete this lesson?")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteLessonAction(lessonId, courseId);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
        Delete
      </Button>
    </span>
  );
}

export function LessonRow({
  lesson,
  courseId,
  showModuleBadge,
  showDelete,
}: {
  lesson: {
    id: string;
    title: string;
    status: ContentStatus;
    description: string | null;
    /** How many files a teacher has attached, so an empty lesson is visible here. */
    materialCount?: number;
    hasVideo?: boolean;
  };
  courseId: string;
  showModuleBadge?: boolean;
  showDelete?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <Link
        href={`/teacher/courses/${courseId}/lessons/${lesson.id}`}
        className="group flex min-w-0 items-center gap-2"
      >
        <Pencil className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{lesson.title}</span>
          {lesson.description && <span className="block truncate text-xs text-muted-foreground">{lesson.description}</span>}
          {/* A teacher otherwise cannot tell a lesson that has a recording from
              one that has nothing but text, without opening every lesson. */}
          {lesson.hasVideo && (
            <span className="block truncate text-xs text-muted-foreground">
              Video attached
            </span>
          )}
        </span>
      </Link>
      <span className="flex shrink-0 items-center gap-1.5">
        {showModuleBadge && <Badge variant="secondary">{lesson.status}</Badge>}
        {lesson.hasVideo ? (
          <Badge variant="outline">
            <PlayCircle className="mr-1 size-3" aria-hidden="true" />
            Video
          </Badge>
        ) : lesson.materialCount ? (
          <Badge variant="outline">
            <Paperclip className="mr-1 size-3" aria-hidden="true" />
            {lesson.materialCount}
          </Badge>
        ) : null}
        {lesson.status === "published" ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}
        {showDelete && <LessonDeleteButton lessonId={lesson.id} courseId={courseId} />}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export function MaterialCreateForm({
  lessonId,
  courseId,
}: {
  lessonId: string;
  courseId: string;
}) {
  const [title, setTitle] = useState("");
  const [fileType, setFileType] = useState("link");
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-2 rounded-md border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createMaterialAction({
            lessonId,
            courseId,
            title: title.trim(),
            fileType,
            fileUrl: fileUrl.trim() || null,
          });
          if (result.ok) {
            setTitle("");
            setFileUrl("");
            setFileType("link");
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr]">
        <div className="grid gap-1.5">
          <Label htmlFor="mat-title" className={fieldLabelClass()}>
            Material title
          </Label>
          <Input id="mat-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Quadratic Equations worksheet" required minLength={2} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mat-type" className={fieldLabelClass()}>
            Type
          </Label>
          <select id="mat-type" className={nativeSelectClass()} value={fileType} onChange={(e) => setFileType(e.target.value)}>
            {Object.entries(materialTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mat-url" className={fieldLabelClass()}>
            File / link URL
          </Label>
          <Input
            id="mat-url"
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://…"
            required
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
          {isPending ? "Adding…" : "Add material"}
        </Button>
        <FieldError error={error} />
      </div>
    </form>
  );
}

/** How often a still-encoding video is re-checked, and for how long. */
const MATERIAL_VIDEO_POLL_MS = 4000;
const MATERIAL_VIDEO_POLL_ATTEMPTS = 30;

export function MaterialChip({
  material,
  lessonId,
  courseId,
  onDelete,
}: {
  material: {
    id: string;
    title: string;
    file_type: string | null;
    file_url: string | null;
    upload_state?: string | null;
  };
  lessonId: string;
  courseId: string;
  onDelete?: (id: string) => Promise<ActionState>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // A video with no playback id yet cannot be opened, so it is shown as
  // in-progress rather than as a dead link. This is the state a teacher sees
  // for the minute or so after a successful upload.
  const isVideo = material.file_type === "video";
  const processing = isVideo && material.upload_state !== "ready";
  const isLink = material.file_type === "link";
  const href = processing ? undefined : material.file_url ?? "#";

  // Ask the host on its own while an upload is still encoding, so the material
  // turns playable without the teacher pressing anything. Every check is a
  // single lookup, and it stops as soon as the video settles one way or the
  // teacher leaves the page.
  useEffect(() => {
    if (!processing) return;

    let cancelled = false;
    let attempt = 0;

    const tick = async () => {
      attempt += 1;
      if (cancelled) return;

      const result = await refreshVideoMaterialAction(material.id, lessonId, courseId);

      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === "errored") {
        setError("The video host could not process that file.");
        return;
      }
      if (result.status === "ready") {
        setNotice("Ready. This video can now be played.");
        // The action revalidates the lesson, but this chip's own `processing`
        // flag comes from the server-rendered props, so the row has to be
        // re-read for the player to appear.
        router.refresh();
        return;
      }
      if (attempt >= MATERIAL_VIDEO_POLL_ATTEMPTS) return;
      pollTimer.current = setTimeout(tick, MATERIAL_VIDEO_POLL_MS);
    };

    pollTimer.current = setTimeout(tick, MATERIAL_VIDEO_POLL_MS);

    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // Re-running on every prop change would restart the poll on each render, so
    // this keys off the material's identity and whether it is still encoding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing, material.id]);

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <a
        href={href}
        target={isLink ? "_blank" : undefined}
        rel="noreferrer"
        aria-disabled={processing || undefined}
        className={`flex min-w-0 items-center gap-2 ${
          processing ? "cursor-default" : "hover:underline"
        }`}
      >
        {processing ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : isVideo ? (
          <PlayCircle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="block truncate font-medium">{material.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {processing
              ? "Video processing on the host, playable shortly"
              : material.file_type
                ? materialTypeLabels[material.file_type] ?? material.file_type
                : "File"}
          </span>
        </span>
      </a>
      {(onDelete || processing) && (
        <span className="flex shrink-0 items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          {processing && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await refreshVideoMaterialAction(
                    material.id,
                    lessonId,
                    courseId,
                  );
                  if (!result.ok) {
                    setError(result.error);
                  } else if (result.status === "errored") {
                    setError("The video host could not process that file.");
                  } else if (result.status === "processing") {
                    setNotice("Still encoding. Try again in a little while.");
                  } else {
                    setNotice("Ready. This video can now be played.");
                  }
                });
              }}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-3.5" aria-hidden="true" />
              )}
              Check status
            </Button>
          )}
          {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete material"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Delete this material?")) return;
              setError(null);
              startTransition(async () => {
                const result = await onDelete(material.id);
                if (!result.ok) setError(result.error);
              });
            }}
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
          </Button>
          )}
        </span>
      )}
      {notice && <span className="sr-only" role="status">{notice}</span>}
    </div>
  );
}