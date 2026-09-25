import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSchoolSite } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  return { title: site ? `Academics at ${site.name}` : "Academics" };
}

export default async function AcademicsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">Academics</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Overview of classes and subjects offered at {site.name}.
      </p>

      <section aria-labelledby="classes-heading" className="mt-10">
        <h2 id="classes-heading" className="text-xl font-semibold">
          Class levels
        </h2>
        {site.classes.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {site.classes.map((cls) => (
              <span
                key={cls.id}
                className="rounded-full border bg-muted px-4 py-1.5 text-sm font-medium"
              >
                {cls.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Class details are being prepared. Contact the school for more.
          </p>
        )}
      </section>

      <section aria-labelledby="subjects-heading" className="mt-10">
        <h2 id="subjects-heading" className="text-xl font-semibold">
          Subjects
        </h2>
        {site.subjects.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {site.subjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4"
              >
                <span className="text-sm font-medium">{subject.name}</span>
                {subject.code && (
                  <span className="text-xs text-muted-foreground">{subject.code}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Subject details are being prepared. Contact the school for more.
          </p>
        )}
      </section>

      <section aria-labelledby="assessment-heading" className="mt-10">
        <h2 id="assessment-heading" className="text-xl font-semibold">
          Learning &amp; assessment
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {site.name} runs its classroom on EduSphere: lessons are delivered in structured
          courses, students practise exam-style questions in timed CBT sessions, and termly
          results are published as report cards for parents. Assessment covers Common
          Entrance, WAEC, NECO and JAMB practice alongside continuous assignments.
        </p>
      </section>
    </div>
  );
}