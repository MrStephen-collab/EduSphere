import type { ExamSeriesType, QuestionDifficulty, QuestionType } from "@/types/database";

export const examTypeLabels: Record<ExamSeriesType, string> = {
  common_entrance: "Common Entrance",
  waec: "WAEC",
  neco: "NECO",
  jamb: "JAMB",
  school: "School",
};

export const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: "Objective",
  true_false: "True / False",
  multiple_answer: "Multiple answer",
  essay: "Essay (manual marking)",
};

export const difficultyLabels: Record<QuestionDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed",
};

export type SelectOption = { id: string; name: string };