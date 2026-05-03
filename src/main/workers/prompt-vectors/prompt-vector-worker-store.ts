/*
Назначение: Выполняет операции хранения и поиска векторов подсказок внутри Worker Thread через локальную embedding-модель и LanceDB.
Не входит: Управление жизненным циклом worker и IPC/renderer-контракты.
*/
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import * as lancedb from "@lancedb/lancedb";
import { env, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import type {
  PromptVectorAddInput,
  PromptVectorDeleteInput,
  PromptVectorEditInput,
  PromptVectorSearchInput,
  PromptVectorSearchResult,
  PromptVectorWorkerConfig
} from "./prompt-vector-worker-protocol";

interface EmbeddingTensor {
  data: Iterable<number>;
  dims?: number[];
}

interface PromptVectorRow {
  [key: string]: number | number[] | string;
  hint_id: string;
  id: string;
  project_id: string;
  updated_at: number;
  vector: number[];
}

const REQUIRED_MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  join("onnx", "model_quantized.onnx")
];

export class PromptVectorWorkerStore {
  private readonly lanceDbPath: string;
  private readonly modelDirectory: string;
  private readonly tableName: string;
  private extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(config: PromptVectorWorkerConfig) {
    this.lanceDbPath = resolve(config.lanceDbPath);
    this.modelDirectory = resolve(config.modelDirectory);
    this.tableName = config.tableName;
  }

  async add(input: PromptVectorAddInput): Promise<void> {
    await this.upsert(input);
  }

  async edit(input: PromptVectorEditInput): Promise<void> {
    await this.upsert(input);
  }

  async delete(input: PromptVectorDeleteInput): Promise<void> {
    const tableContext = await this.openExistingTable();

    if (!tableContext) {
      return;
    }

    try {
      await tableContext.table.delete(this.buildIdPredicate(input.projectId, input.hintId));
    } finally {
      tableContext.table.close();
      tableContext.connection.close();
    }
  }

  async search(input: PromptVectorSearchInput): Promise<PromptVectorSearchResult[]> {
    const tableContext = await this.openExistingTable();

    if (!tableContext) {
      return [];
    }

    try {
      const vector = await this.embed(input.text);
      let query = tableContext.table
        .vectorSearch(vector)
        .column("vector")
        .distanceType("cosine");

      if (input.projectId) {
        query = query.where(this.buildProjectPredicate(input.projectId));
      }

      const rows = await query
        .select(["project_id", "hint_id", "_distance"])
        .limit(input.limit)
        .toArray();

      return rows.map((row) => ({
        projectId: String(row.project_id),
        hintId: String(row.hint_id),
        score: toCosineScore(row._distance)
      }));
    } finally {
      tableContext.table.close();
      tableContext.connection.close();
    }
  }

  private async upsert(input: PromptVectorAddInput | PromptVectorEditInput): Promise<void> {
    const row = await this.createRow(input);
    mkdirSync(this.lanceDbPath, { recursive: true });

    const connection = await lancedb.connect(this.lanceDbPath);
    let table: Awaited<ReturnType<typeof connection.openTable>> | null = null;

    try {
      const tableNames = await connection.tableNames();

      if (!tableNames.includes(this.tableName)) {
        table = await connection.createTable(this.tableName, [row], {
          existOk: true,
          mode: "create"
        });
        return;
      }

      table = await connection.openTable(this.tableName);
      await table.delete(this.buildIdPredicate(input.projectId, input.hintId));
      await table.add([row]);
    } finally {
      table?.close();
      connection.close();
    }
  }

  private async openExistingTable(): Promise<{
    connection: Awaited<ReturnType<typeof lancedb.connect>>;
    table: Awaited<ReturnType<Awaited<ReturnType<typeof lancedb.connect>>["openTable"]>>;
  } | null> {
    if (!existsSync(this.lanceDbPath)) {
      return null;
    }

    const connection = await lancedb.connect(this.lanceDbPath);
    const tableNames = await connection.tableNames();

    if (!tableNames.includes(this.tableName)) {
      connection.close();
      return null;
    }

    return {
      connection,
      table: await connection.openTable(this.tableName)
    };
  }

  private async createRow(input: PromptVectorAddInput | PromptVectorEditInput): Promise<PromptVectorRow> {
    return {
      id: this.buildRowId(input.projectId, input.hintId),
      project_id: input.projectId,
      hint_id: input.hintId,
      vector: await this.embed(input.text),
      updated_at: Date.now()
    };
  }

  private async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const tensor = (await extractor([text])) as EmbeddingTensor;
    const vector = Array.from(tensor.data);

    if (vector.length === 0) {
      throw new Error("Embedding model returned an empty vector.");
    }

    return vector;
  }

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractorPromise) {
      this.assertModelFilesExist();

      const modelParentDirectory = dirname(this.modelDirectory);
      const modelName = basename(this.modelDirectory);

      const mutableEnv = env as {
        allowLocalModels: boolean;
        allowRemoteModels: boolean;
        localModelPath: string;
        useFSCache: boolean;
      };

      mutableEnv.allowRemoteModels = false;
      mutableEnv.allowLocalModels = true;
      mutableEnv.useFSCache = false;
      mutableEnv.localModelPath = `${toTransformersPath(modelParentDirectory)}/`;

      this.extractorPromise = pipeline("feature-extraction", modelName, {
        local_files_only: true,
        quantized: true
      }) as Promise<FeatureExtractionPipeline>;
    }

    return this.extractorPromise;
  }

  private assertModelFilesExist(): void {
    const missingFiles = REQUIRED_MODEL_FILES.filter((fileName) => {
      return !existsSync(join(this.modelDirectory, fileName));
    });

    if (missingFiles.length === 0) {
      return;
    }

    const missingList = missingFiles.map((fileName) => join(this.modelDirectory, fileName)).join(", ");
    throw new Error(`Не хватает файлов локальной embedding-модели: ${missingList}`);
  }

  private buildIdPredicate(projectId: string, hintId: string): string {
    return `id = '${escapeSqlString(this.buildRowId(projectId, hintId))}'`;
  }

  private buildProjectPredicate(projectId: string): string {
    return `project_id = '${escapeSqlString(projectId)}'`;
  }

  private buildRowId(projectId: string, hintId: string): string {
    return `${toBase64Url(projectId)}.${toBase64Url(hintId)}`;
  }
}

function toTransformersPath(value: string): string {
  return value.split(sep).join("/");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function toCosineScore(distance: unknown): number {
  const numericDistance = Number(distance);

  if (!Number.isFinite(numericDistance)) {
    return 0;
  }

  return 1 - numericDistance;
}
