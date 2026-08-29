"use client";

// 題目管理：獨立資料列 + order 欄位，用上下箭頭調整順序即可，
// 不需要 tpass-form 那種拖拉建構器（沒有分段/跳轉，複雜度用不到）。
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { QuestionView } from "@/lib/questions";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  needsOptions,
  createOption,
  type QType,
  type Option,
} from "@/lib/question-schema";
import {
  createQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  moveQuestionAction,
} from "@/app/admin/questions/actions";
import type { QuestionInput } from "@/lib/questions";
import { Button, Input, Textarea, Select, Label, Switch, Badge, cn } from "tpass-ui";

export function QuestionEditor({ questions }: { questions: QuestionView[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<QuestionView | "new" | null>(null);

  async function handleMove(id: string, dir: "up" | "down") {
    await moveQuestionAction(id, dir);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這一題嗎？（已送出的申訴答案不受影響）")) return;
    await deleteQuestionAction(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> 新增題目
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-foreground/40 bg-muted/40 p-5 text-center font-medium text-muted-foreground">
          還沒有題目，點右上角新增。
        </p>
      )}

      <div className="flex flex-col gap-3">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="flex items-start justify-between gap-3 rounded-2xl border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_var(--color-foreground)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge>{QUESTION_TYPE_LABELS[q.type]}</Badge>
                {q.required && <Badge className="bg-tone-rose-bg">必填</Badge>}
              </div>
              <p className="mt-2 font-bold truncate">{q.title || "（未命名題目）"}</p>
              {q.description && (
                <p className="mt-1 text-sm font-medium text-muted-foreground truncate">
                  {q.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <IconButton onClick={() => handleMove(q.id, "up")} disabled={idx === 0} label="上移">
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton
                onClick={() => handleMove(q.id, "down")}
                disabled={idx === questions.length - 1}
                label="下移"
              >
                <ArrowDown className="h-4 w-4" />
              </IconButton>
              <IconButton onClick={() => setEditing(q)} label="編輯">
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton onClick={() => handleDelete(q.id)} label="刪除" destructive>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <QuestionFormDialog
          question={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-foreground bg-card shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] disabled:opacity-30 disabled:pointer-events-none",
        destructive && "text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function QuestionFormDialog({
  question,
  onClose,
  onSaved,
}: {
  question: QuestionView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = React.useState<QType>(question?.type ?? "short_text");
  const [title, setTitle] = React.useState(question?.title ?? "");
  const [description, setDescription] = React.useState(question?.description ?? "");
  const [required, setRequired] = React.useState(question?.required ?? false);
  const [options, setOptions] = React.useState<Option[]>(question?.options ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function handleTypeChange(next: QType) {
    setType(next);
    setOptions((cur) => (needsOptions(next) && cur.length === 0 ? [createOption("選項 1")] : cur));
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("題目標題不能空白。");
      return;
    }
    const cleanOptions = options.filter((o) => o.label.trim());
    if (needsOptions(type) && cleanOptions.length === 0) {
      setError("至少需要一個選項。");
      return;
    }
    setPending(true);
    setError(null);
    const input: QuestionInput = {
      type,
      title: title.trim(),
      description: description.trim() || null,
      required,
      options: needsOptions(type) ? cleanOptions : null,
    };
    const res = question
      ? await updateQuestionAction(question.id, input)
      : await createQuestionAction(input);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "儲存失敗。");
      return;
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-foreground bg-card p-6 shadow-[6px_6px_0_0_var(--color-foreground)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-extrabold text-xl mb-4">{question ? "編輯題目" : "新增題目"}</h2>

        <div className="flex flex-col gap-4">
          <div>
            <Label>題型</Label>
            <Select
              className="mt-2"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as QType)}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>標題</Label>
            <Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>說明（選填）</Label>
            <Textarea
              className="mt-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {needsOptions(type) && (
            <div>
              <Label>選項</Label>
              <div className="mt-2 flex flex-col gap-2">
                {options.map((o, i) => (
                  <div key={o.id} className="flex gap-2">
                    <Input
                      value={o.label}
                      onChange={(e) =>
                        setOptions((os) =>
                          os.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}
                      disabled={options.length <= 1}
                    >
                      移除
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() =>
                    setOptions((os) => [...os, createOption(`選項 ${os.length + 1}`)])
                  }
                  className="self-start"
                >
                  <Plus className="h-4 w-4" /> 加選項
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t-2 border-dashed border-foreground/15 pt-4">
            <Label>必填</Label>
            <Switch checked={required} onChange={setRequired} label="必填" />
          </div>

          {error && <p className="font-mono text-xs font-bold text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={pending}>
              {pending ? "儲存中…" : "儲存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
