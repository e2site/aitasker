/*
Назначение: Запускает Worker Thread для одной операции с векторами подсказок и возвращает результат main-thread сервису.
Не входит: Валидация renderer-ввода, управление очередью операций и долгоживущие кэши.
*/
import { parentPort, workerData } from "node:worker_threads";
import { PromptVectorWorkerStore } from "./prompt-vector-worker-store";
import type {
  PromptVectorWorkerRequest,
  PromptVectorWorkerResponse,
  PromptVectorWorkerResult
} from "./prompt-vector-worker-protocol";

async function run(request: PromptVectorWorkerRequest): Promise<PromptVectorWorkerResult> {
  const store = new PromptVectorWorkerStore(request.config);

  switch (request.operation.type) {
    case "add":
      await store.add(request.operation.input);
      return { type: "add", value: null };
    case "search":
      return {
        type: "search",
        value: await store.search(request.operation.input)
      };
    case "edit":
      await store.edit(request.operation.input);
      return { type: "edit", value: null };
    case "delete":
      await store.delete(request.operation.input);
      return { type: "delete", value: null };
  }
}

async function main(): Promise<void> {
  if (!parentPort) {
    throw new Error("Prompt vector worker must be started from worker_threads.");
  }

  try {
    const result = await run(workerData as PromptVectorWorkerRequest);
    parentPort.postMessage({ ok: true, result } satisfies PromptVectorWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    parentPort.postMessage({ ok: false, error: { message, stack } } satisfies PromptVectorWorkerResponse);
  }
}

void main();
