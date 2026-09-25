import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">About {process.env.NEXT_PUBLIC_PLATFORM_NAME}</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          EduSphere gives Nigerian schools a modern digital academic environment —
          combining digital learning, computer-based testing, assignments, results
          and academic analytics in one secure platform.
        </p>
        <p>
          Our mission is to help every school — from the smallest private primary
          school to the largest secondary school — deliver an excellent, modern
          education with technology that teachers and students actually enjoy using.
        </p>
        <p>
          We started in Akure, Ondo State, and we are building for the whole of
          Nigeria and beyond.
        </p>
      </div>
    </div>
  );
}