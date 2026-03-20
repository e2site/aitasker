/*
Назначение: Хранит состояние MCP-сессии одного AI-агента и управляет деградацией доверия к его контексту.
Не входит: Регистрация MCP-инструментов, бизнес-логика сервисов, сериализация ответов.
*/

// --- Пороги (настраивать по результатам тестирования) ---
export const SESSION_STALE_MS = 100 * 60 * 1000;    // 100 мин без активности → stale
export const SESSION_STALE_INTERACTIONS = 30;        // 30 шагов подряд → stale
export const SESSION_LOST_MS = 600 * 60 * 1000;      // 600 мин без активности → lost

export interface AgentSession {
  taskId: string | null;
  lastContextVersion: number | null;  // timestamp последней отдачи контекста
  state: "fresh" | "stale" | "lost";
  lastUsedAt: number | null;
  interactionCount: number;
  lastMode: "work" | "delta" | null;
  runId: string | null;               // меняется при activate_project → признак новой сессии
}

export function createFreshSession(runId: string): AgentSession {
  return {
    taskId: null,
    lastContextVersion: null,
    state: "fresh",
    lastUsedAt: Date.now(),
    interactionCount: 0,
    lastMode: null,
    runId
  };
}

export function generateRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function touchSession(
  session: AgentSession,
  patch: { taskId?: string; mode?: AgentSession["lastMode"] }
): AgentSession {
  const now = Date.now();
  let state = session.state;
  let interactionCount = session.interactionCount;

  if (session.lastUsedAt !== null) {
    const idle = now - session.lastUsedAt;

    if (idle >= SESSION_LOST_MS) {
      state = "lost";
      interactionCount = 0;
    } else if (idle >= SESSION_STALE_MS) {
      state = "stale";
    }
  }

  if (state === "fresh" && interactionCount >= SESSION_STALE_INTERACTIONS) {
    state = "stale";
  }

  return {
    ...session,
    state,
    lastUsedAt: now,
    lastContextVersion: now,
    interactionCount: interactionCount + 1,
    taskId: patch.taskId !== undefined ? patch.taskId : session.taskId,
    lastMode: patch.mode !== undefined ? patch.mode : session.lastMode
  };
}

/**
 * Переводит сессию в work-режим для указанной задачи.
 * lastContextVersion фиксируется как момент отдачи полного снапшота.
 */
export function startWork(session: AgentSession, taskId: string): AgentSession {
  const now = Date.now();

  return {
    ...session,
    taskId,
    lastContextVersion: now,
    lastUsedAt: now,
    lastMode: "work",
    state: "fresh",
    interactionCount: session.interactionCount + 1
  };
}

/**
 * Переводит сессию в delta-режим и сдвигает lastContextVersion на текущий момент,
 * чтобы следующая дельта показывала только изменения после этого вызова.
 */
export function toDeltaMode(session: AgentSession): AgentSession {
  const now = Date.now();

  return {
    ...session,
    lastMode: "delta",
    lastUsedAt: now,
    lastContextVersion: now,
    interactionCount: session.interactionCount + 1
  };
}
