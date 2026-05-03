/*
Назначение: Описывает протокол сообщений между main-thread сервисом векторов подсказок и Worker Thread.
Не входит: Запуск worker, работа с LanceDB и получение embedding-векторов.
*/

export interface PromptVectorWorkerConfig {
  lanceDbPath: string;
  modelDirectory: string;
  tableName: string;
}

export interface PromptVectorAddInput {
  hintId: string;
  projectId: string;
  text: string;
}

export interface PromptVectorSearchInput {
  limit: number;
  projectId?: string;
  text: string;
}

export interface PromptVectorEditInput {
  hintId: string;
  projectId: string;
  text: string;
}

export interface PromptVectorDeleteInput {
  hintId: string;
  projectId: string;
}

export interface PromptVectorSearchResult {
  hintId: string;
  projectId: string;
  score: number;
}

export type PromptVectorWorkerOperation =
  | { input: PromptVectorAddInput; type: "add" }
  | { input: PromptVectorSearchInput; type: "search" }
  | { input: PromptVectorEditInput; type: "edit" }
  | { input: PromptVectorDeleteInput; type: "delete" };

export interface PromptVectorWorkerRequest {
  config: PromptVectorWorkerConfig;
  operation: PromptVectorWorkerOperation;
}

export type PromptVectorWorkerResult =
  | { type: "add"; value: null }
  | { type: "search"; value: PromptVectorSearchResult[] }
  | { type: "edit"; value: null }
  | { type: "delete"; value: null };

export type PromptVectorWorkerResponse =
  | { ok: true; result: PromptVectorWorkerResult }
  | { error: { message: string; stack?: string }; ok: false };
