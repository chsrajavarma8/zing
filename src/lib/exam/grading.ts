import type { Json } from "@/types/database";

interface GradableQuestion {
  id: string;
  question_type: "mcq_single" | "mcq_multi" | "short_text";
  correct_answer: Json | null;
  marks: number;
}

export function gradeAnswer(question: GradableQuestion, answer: Json | null): { isCorrect: boolean | null; marksAwarded: number | null } {
  if (question.question_type === "short_text") {
    return { isCorrect: null, marksAwarded: null }; // manual grading required
  }
  if (!question.correct_answer || !answer) return { isCorrect: false, marksAwarded: 0 };

  if (question.question_type === "mcq_single") {
    const correct = (question.correct_answer as { selected?: string }).selected;
    const given = (answer as { selected?: string }).selected;
    const isCorrect = Boolean(correct && given && correct === given);
    return { isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
  }

  // mcq_multi: exact set match required for full marks
  const correctSet = new Set(((question.correct_answer as { selected?: string[] }).selected ?? []) as string[]);
  const givenSet = new Set(((answer as { selected?: string[] }).selected ?? []) as string[]);
  const isCorrect =
    correctSet.size === givenSet.size && [...correctSet].every((v) => givenSet.has(v));
  return { isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
}
