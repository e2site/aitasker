/*
Назначение: Предоставляет main-thread API для добавления, поиска, редактирования и удаления векторов подсказок через одноразовые Worker Thread.
Не входит: Хранение текста подсказок в SQLite, renderer IPC и реализация LanceDB-операций внутри worker.
*/
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import type {
  PromptVectorAddInput,
  PromptVectorDeleteInput,
  PromptVectorEditInput,
  PromptVectorSearchInput,
  PromptVectorSearchResult,
  PromptVectorWorkerConfig,
  PromptVectorWorkerOperation,
  PromptVectorWorkerRequest,
  PromptVectorWorkerResponse,
  PromptVectorWorkerResult
} from "../workers/prompt-vectors/prompt-vector-worker-protocol";

export type {
  PromptVectorAddInput,
  PromptVectorDeleteInput,
  PromptVectorEditInput,
  PromptVectorSearchInput,
  PromptVectorSearchResult
} from "../workers/prompt-vectors/prompt-vector-worker-protocol";

export interface PromptVectorServiceOptions {
  lanceDbPath: string;
  modelDirectory: string;
  operationTimeoutMs?: number;
  tableName?: string;
  workerUrl?: URL;
}

export interface PromptVectorService {
  add(input: PromptVectorAddInput): Promise<void>;
  delete(input: PromptVectorDeleteInput): Promise<void>;
  edit(input: PromptVectorEditInput): Promise<void>;
  search(input: PromptVectorSearchInput): Promise<PromptVectorSearchResult[]>;
}

const DEFAULT_OPERATION_TIMEOUT_MS = 120_000;
const DEFAULT_TABLE_NAME = "prompt_hint_vectors";

export function createPromptVectorService(options: PromptVectorServiceOptions): PromptVectorService {
  return new WorkerPromptVectorService(options);
}

class WorkerPromptVectorService implements PromptVectorService {
  private readonly config: PromptVectorWorkerConfig;
  private readonly operationTimeoutMs: number;
  private readonly workerUrl: URL;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: PromptVectorServiceOptions) {
    this.config = {
      lanceDbPath: resolve(options.lanceDbPath),
      modelDirectory: resolve(options.modelDirectory),
      tableName: options.tableName ?? DEFAULT_TABLE_NAME
    };
    this.operationTimeoutMs = options.operationTimeoutMs ?? DEFAULT_OPERATION_TIMEOUT_MS;
    this.workerUrl = options.workerUrl ?? resolveDefaultWorkerUrl();

    mkdirSync(this.config.lanceDbPath, { recursive: true });
  }

  async add(input: PromptVectorAddInput): Promise<void> {
    validateEntityInput(input);
    validateText(input.text);
    await this.enqueue(async () => {
      await this.runOperation({ type: "add", input });
    });
  }

  async edit(input: PromptVectorEditInput): Promise<void> {
    validateEntityInput(input);
    validateText(input.text);
    await this.enqueue(async () => {
      await this.runOperation({ type: "edit", input });
    });
  }

  async delete(input: PromptVectorDeleteInput): Promise<void> {
    validateEntityInput(input);
    await this.enqueue(async () => {
      await this.runOperation({ type: "delete", input });
    });
  }

  async search(input: PromptVectorSearchInput): Promise<PromptVectorSearchResult[]> {
    validateText(input.text);
    if (input.projectId !== undefined) {
      validateProjectId(input.projectId);
    }
    const limit = normalizeLimit(input.limit);

    const result = await this.enqueue(async () => {
      return this.runOperation({ type: "search", input: { ...input, limit } });
    });

    if (result.type !== "search") {
      throw new Error(`Unexpected prompt vector worker result: ${result.type}`);
    }

    return result.value;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);

    this.queue = run.then(
      () => undefined,
      () => undefined
    );

    return run;
  }

  private runOperation(operation: PromptVectorWorkerOperation): Promise<PromptVectorWorkerResult> {
    const request: PromptVectorWorkerRequest = {
      config: this.config,
      operation
    };

    return new Promise((resolvePromise, reject) => {
      const worker = new Worker(this.workerUrl, {
        execArgv: [],
        workerData: request
      });
      let settled = false;

      const timeout = windowlessSetTimeout(() => {
        finish(() => {
          void worker.terminate();
          reject(new Error(`Prompt vector worker timed out after ${this.operationTimeoutMs} ms.`));
        });
      }, this.operationTimeoutMs);

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        callback();
      };

      worker.once("message", (message: PromptVectorWorkerResponse) => {
        finish(() => {
          void worker.terminate();

          if (message.ok) {
            resolvePromise(message.result);
            return;
          }

          reject(new Error(message.error.message));
        });
      });

      worker.once("error", (error) => {
        finish(() => {
          reject(error);
        });
      });

      worker.once("exit", (code) => {
        if (code === 0) {
          return;
        }

        finish(() => {
          reject(new Error(`Prompt vector worker exited with code ${code}.`));
        });
      });
    });
  }
}

function validateEntityInput(input: PromptVectorDeleteInput): void {
  validateProjectId(input.projectId);

  if (!input.hintId.trim()) {
    throw new Error("Hint id is required for prompt vector operation.");
  }
}

function validateProjectId(projectId: string): void {
  if (!projectId.trim()) {
    throw new Error("Project id is required for prompt vector operation.");
  }
}

function validateText(text: string): void {
  if (!text.trim()) {
    throw new Error("Text is required for prompt vector operation.");
  }
}

function normalizeLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Prompt vector search limit must be a positive integer.");
  }

  return value;
}

function windowlessSetTimeout(callback: () => void, timeoutMs: number): NodeJS.Timeout {
  return setTimeout(callback, timeoutMs);
}

function resolveDefaultWorkerUrl(): URL {
  const currentUrl = new URL(import.meta.url);

  if (
    currentUrl.pathname.endsWith("/services/prompt-vector-service.js") ||
    currentUrl.pathname.endsWith("/services/prompt-vector-service.ts")
  ) {
    return new URL("../workers/prompt-vectors/prompt-vector.worker.js", currentUrl);
  }

  return new URL("./workers/prompt-vectors/prompt-vector.worker.js", currentUrl);
}
