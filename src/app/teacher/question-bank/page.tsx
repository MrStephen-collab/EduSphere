import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Library, FileQuestion, FolderOpen } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getQuestionBanks } from "@/services/question-bank";
import { getSubjects, getClasses } from "@/services/academics";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  CreateQuestionBankForm,
  BankDeleteButton,
  type OptionDef,
} from "@/components/teacher/question-bank-forms";

export const metadata: Metadata = {
  title: "Question bank",
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TeacherQuestionBankPage() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();
  const [banks, subjects, classes] = await Promise.all([
    getQuestionBanks(schoolId),
    getSubjects(schoolId),
    getClasses(schoolId),
  ]);

  const subjectOptions: OptionDef[] = subjects.map((s) => ({ id: s.id, name: s.name }));
  const classOptions: OptionDef[] = classes.map((c) => ({ id: c.id, name: c.name }));

  return (
    <DashboardShell title="Question Bank" badge="Teacher">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Build reusable question pools you can attach to exam series.
          </p>
          <CreateQuestionBankForm subjects={subjectOptions} classes={classOptions} />
        </div>

        {banks.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No question banks yet"
            description="Create a bank, then add questions with answers to reuse across exam series."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((bank) => (
              <Card key={bank.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{bank.name}</CardTitle>
                    <BankDeleteButton id={bank.id} name={bank.name} />
                  </div>
                  <CardDescription className="line-clamp-2">
                    {bank.description ?? (
                      <span className="text-muted-foreground/70">No description.</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto grid gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {bank.subjectName && <Badge variant="outline">{bank.subjectName}</Badge>}
                    {bank.className && <Badge variant="outline">{bank.className}</Badge>}
                    <Badge variant="secondary">
                      <FileQuestion className="mr-1 size-3" aria-hidden="true" />
                      {bank.questionCount} question{bank.questionCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {bank.authorName ? `by ${bank.authorName}` : "No author"}
                      {bank.createdAt ? ` · ${formatDate(bank.createdAt)}` : ""}
                    </span>
                    <Button size="sm" render={<Link href={`/teacher/question-bank/${bank.id}`} />}>
                      <FolderOpen className="mr-1 size-4" aria-hidden="true" />
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}