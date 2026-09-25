import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Library } from "lucide-react";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { getQuestionBankDetail } from "@/services/question-bank";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  BankQuestionForm,
  BankQuestionRow,
  type BankQuestionView,
} from "@/components/teacher/question-bank-forms";

export const metadata: Metadata = {
  title: "Question bank",
  robots: { index: false, follow: false },
};

function toView(question: {
  id: string;
  questionText: string;
  questionType: string;
  topic: string | null;
  difficulty: string;
  marks: number;
  explanation: string | null;
  options: { id: string; optionText: string; isCorrect: boolean }[];
}): BankQuestionView {
  return {
    id: question.id,
    questionText: question.questionText,
    questionType: question.questionType,
    topic: question.topic,
    difficulty: question.difficulty,
    marks: question.marks,
    explanation: question.explanation,
    options: question.options,
  };
}

export default async function TeacherQuestionBankDetailPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const { bankId } = await params;

  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (!context.roles.includes("TEACHER")) redirect("/dashboard");

  const { schoolId } = await requireContentEditor();
  const bank = await getQuestionBankDetail(schoolId, bankId);

  if (!bank) {
    return (
      <DashboardShell title="Question bank not found">
        <p className="text-sm text-muted-foreground">
          This question bank could not be found or was deleted.
        </p>
        <Link href="/teacher/question-bank" className="mt-4 inline-flex">
          <Button variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to question bank
          </Button>
        </Link>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={bank.name}
      badge={[bank.subjectName ?? "All subjects", bank.className ?? "All classes"]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {bank.questions.length} question{bank.questions.length === 1 ? "" : "s"}
              </CardTitle>
              <BankQuestionForm bankId={bankId} />
            </div>
          </CardHeader>
        </Card>

        {bank.questions.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No questions yet"
            description="Add your first question to this bank — it will become available when you attach the bank to an exam series."
          />
        ) : (
          <div className="grid gap-2">
            {bank.questions.map((q) => (
              <BankQuestionRow key={q.id} question={toView(q)} bankId={bankId} />
            ))}
          </div>
        )}

        {bank.description && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{bank.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {bank.createdAt ? (
            <Badge variant="outline">Created {new Date(bank.createdAt).toLocaleDateString()}</Badge>
          ) : null}
          {bank.authorName ? <Badge variant="outline">by {bank.authorName}</Badge> : null}
        </div>
      </div>
    </DashboardShell>
  );
}