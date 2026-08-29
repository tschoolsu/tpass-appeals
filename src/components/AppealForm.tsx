"use client";

// 申訴表單：單頁列出所有題目（無分段/跳轉），送出後打 submitAppealAction。
import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";
import type { QuestionView } from "@/lib/questions";
import { validateValue, type AnswerMap } from "@/lib/answers";
import { QuestionRenderer } from "@/components/QuestionRenderer";
import { Button } from "tpass-ui";
import { submitAppealAction, type SubmitResult } from "@/app/actions";

interface Props {
  title: string;
  introText: string;
  acceptingResponses: boolean;
  questions: QuestionView[];
  identityNotice: string;
}

export function AppealForm({
  title,
  introText,
  acceptingResponses,
  questions,
  identityNotice,
}: Props) {
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const setAnswer = (qid: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    setErrors((e) => {
      if (!e[qid]) return e;
      const { [qid]: _omit, ...rest } = e;
      return rest;
    });
  };

  async function handleSubmit() {
    const next: Record<string, string> = {};
    for (const q of questions) {
      const err = validateValue(q, answers[q.id]);
      if (err) next[q.id] = err;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setMessage(null);
    let res: SubmitResult;
    try {
      res = await submitAppealAction(answers);
    } finally {
      setSubmitting(false);
    }
    if (res.ok) {
      setDone(true);
    } else {
      if (res.errors) setErrors(res.errors);
      setMessage(res.message ?? "送出失敗，請再試一次。");
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-foreground bg-card p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-4 font-extrabold text-2xl">已送出，謝謝你！</h2>
        <p className="mt-2 font-medium text-muted-foreground">
          你的申訴已經收到，學生會會盡快處理。
        </p>
      </div>
    );
  }

  if (!acceptingResponses) {
    return (
      <div className="rounded-2xl border-2 border-foreground bg-tone-rose-bg p-10 text-center shadow-[4px_4px_0_0_var(--color-foreground)]">
        <h2 className="font-extrabold text-2xl">目前沒有開放收件</h2>
        <p className="mt-2 font-medium text-foreground/80">請稍後再回來，或直接聯繫學生會。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border-2 border-foreground bg-tone-violet-bg p-6 shadow-[4px_4px_0_0_var(--color-foreground)]">
        <h1 className="font-extrabold text-2xl sm:text-3xl tracking-tight">{title}</h1>
        {introText && (
          <p className="mt-2 font-medium text-foreground/80 whitespace-pre-wrap">{introText}</p>
        )}
        <p className="mt-3 inline-block rounded-md border-2 border-foreground bg-card px-2 py-1 font-mono text-[11px] font-bold">
          {identityNotice}
        </p>
      </div>

      {questions.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-foreground/40 bg-muted/40 p-5 text-center font-medium text-muted-foreground">
          表單尚未設定題目，請稍後再回來。
        </p>
      )}

      {questions.map((q) => (
        <div
          key={q.id}
          className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]"
        >
          <QuestionRenderer
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
            error={errors[q.id]}
          />
        </div>
      ))}

      {message && (
        <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 font-bold text-sm">
          {message}
        </p>
      )}

      {questions.length > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4" /> {submitting ? "送出中…" : "送出申訴"}
          </Button>
        </div>
      )}
    </div>
  );
}
