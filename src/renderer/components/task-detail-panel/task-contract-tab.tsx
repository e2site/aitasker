/*
Назначение: Отрисовывает вкладку "Контракт задачи" с выводом и редактированием полей goal, criticalConditions, forbiddenInterpretations и acceptanceCriteria.
Не входит: Управление вкладками карточки задачи, редактирование markdown-плана и обновление статуса задачи.
*/
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/renderer/components/ui/button";
import { Label } from "@/renderer/components/ui/label";
import { Separator } from "@/renderer/components/ui/separator";
import { Textarea } from "@/renderer/components/ui/textarea";
import type { TaskContextRecord, TaskDetail } from "@/shared/contracts/desktop-api";

function toTextareaValue(items: string[]): string {
  return items.join("\n");
}

function parseTextareaValue(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of value.split(/\r?\n/g)) {
    const normalized = line.trim();

    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function formatCounterLabel(items: string[]): string {
  if (items.length === 0) {
    return "Пока пусто";
  }

  if (items.length === 1) {
    return "1 пункт";
  }

  return `${items.length} пунктов`;
}

export interface TaskContractTabProps {
  detail: TaskDetail;
  isDeletingTask: boolean;
  isRestoringRevision: boolean;
  isSavingPlan: boolean;
  onSaveTaskContract(taskId: string, taskContext: TaskContextRecord): void;
}

export function TaskContractTab(props: TaskContractTabProps) {
  const [goalDraft, setGoalDraft] = useState("");
  const [criticalConditionsDraft, setCriticalConditionsDraft] = useState("");
  const [forbiddenInterpretationsDraft, setForbiddenInterpretationsDraft] = useState("");
  const [acceptanceCriteriaDraft, setAcceptanceCriteriaDraft] = useState("");

  const initialDraft = useMemo(
    () => ({
      goal: toTextareaValue(props.detail.taskContext.goal),
      criticalConditions: toTextareaValue(props.detail.taskContext.criticalConditions),
      forbiddenInterpretations: toTextareaValue(props.detail.taskContext.forbiddenInterpretations),
      acceptanceCriteria: toTextareaValue(props.detail.taskContext.acceptanceCriteria)
    }),
    [props.detail.task.id, props.detail.taskContext]
  );

  useEffect(() => {
    setGoalDraft(initialDraft.goal);
    setCriticalConditionsDraft(initialDraft.criticalConditions);
    setForbiddenInterpretationsDraft(initialDraft.forbiddenInterpretations);
    setAcceptanceCriteriaDraft(initialDraft.acceptanceCriteria);
  }, [initialDraft, props.detail.task.id]);

  const hasPlan = Boolean(props.detail.plan);
  const busy = props.isSavingPlan || props.isDeletingTask || props.isRestoringRevision;
  const isDirty =
    goalDraft !== initialDraft.goal ||
    criticalConditionsDraft !== initialDraft.criticalConditions ||
    forbiddenInterpretationsDraft !== initialDraft.forbiddenInterpretations ||
    acceptanceCriteriaDraft !== initialDraft.acceptanceCriteria;

  const canSave = hasPlan && isDirty && !busy;

  return (
    <section className="space-y-4 rounded-2xl border bg-muted/20 p-4">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Контракт задачи</h3>
        <p className="text-xs text-muted-foreground">
          По одному пункту на строку. Пустые строки и дубли будут удалены при сохранении.
        </p>
      </header>

      {!hasPlan && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Сначала сохраните вкладку «План». Контракт задачи сохраняется через `savePlan`.
        </div>
      )}

      <div className="grid gap-4">
        <ContractField
          id="task-contract-goal"
          label="Главные цели"
          description={formatCounterLabel(props.detail.taskContext.goal)}
          value={goalDraft}
          onChange={setGoalDraft}
          disabled={busy}
        />
        <ContractField
          id="task-contract-critical-conditions"
          label="Критические условия"
          description={formatCounterLabel(props.detail.taskContext.criticalConditions)}
          value={criticalConditionsDraft}
          onChange={setCriticalConditionsDraft}
          disabled={busy}
        />
        <ContractField
          id="task-contract-forbidden-interpretations"
          label="Недопустимые трактовки"
          description={formatCounterLabel(props.detail.taskContext.forbiddenInterpretations)}
          value={forbiddenInterpretationsDraft}
          onChange={setForbiddenInterpretationsDraft}
          disabled={busy}
        />
        <ContractField
          id="task-contract-acceptance-criteria"
          label="Критерии приемки"
          description={formatCounterLabel(props.detail.taskContext.acceptanceCriteria)}
          value={acceptanceCriteriaDraft}
          onChange={setAcceptanceCriteriaDraft}
          disabled={busy}
        />
      </div>

      <Separator />

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty || busy}
          onClick={() => {
            setGoalDraft(initialDraft.goal);
            setCriticalConditionsDraft(initialDraft.criticalConditions);
            setForbiddenInterpretationsDraft(initialDraft.forbiddenInterpretations);
            setAcceptanceCriteriaDraft(initialDraft.acceptanceCriteria);
          }}
        >
          Отмена
        </Button>
        <Button
          type="button"
          disabled={!canSave}
          onClick={() =>
            props.onSaveTaskContract(props.detail.task.id, {
              goal: parseTextareaValue(goalDraft),
              criticalConditions: parseTextareaValue(criticalConditionsDraft),
              forbiddenInterpretations: parseTextareaValue(forbiddenInterpretationsDraft),
              acceptanceCriteria: parseTextareaValue(acceptanceCriteriaDraft)
            })
          }
        >
          {props.isSavingPlan ? "Сохраняем..." : "Сохранить контракт"}
        </Button>
      </div>
    </section>
  );
}

interface ContractFieldProps {
  id: string;
  label: string;
  description: string;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
}

function ContractField(props: ContractFieldProps) {
  return (
    <div className="space-y-2 rounded-xl border bg-background p-3">
      <div className="space-y-1">
        <Label htmlFor={props.id} className="font-mono text-xs text-foreground">
          {props.label}
        </Label>
        <p className="text-xs text-muted-foreground">{props.description}</p>
      </div>
      <Textarea
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        rows={6}
        className="w-full"
        placeholder="Один пункт на строку"
      />
    </div>
  );
}
