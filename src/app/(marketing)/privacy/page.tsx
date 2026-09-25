import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          EduSphere is designed with the privacy and protection of student records
          as a priority, consistent with Nigerian data protection requirements.
        </p>
        <p>
          Student records are accessible only to the student, their parents or
          guardians, and authorized school staff. We do not sell personal data and
          we limit the collection of personal information to what is necessary to
          operate the platform.
        </p>
        <p>
          This policy will be completed in full before public deployment.
        </p>
      </div>
    </div>
  );
}