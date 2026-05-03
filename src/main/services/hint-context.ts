/*
Назначение: Facade над подсказками проекта — объединяет SQLite-репозиторий и векторный сервис для списка, поиска с оценкой совпадения, создания, редактирования и удаления.
Не входит: IPC-транспорт, renderer-состояние и низкоуровневая работа LanceDB/Worker Thread.
*/
import type {
  PromptHintRepository
} from "../db/prompt-hint-repository";
import type {
  PromptHintRecord,
  PromptHintSearchResult
} from "../../shared/contracts/desktop-api";
import type { PromptVectorSearchResult, PromptVectorService } from "./prompt-vector-service";

export class HintContext {
  private readonly projectId: string;
  private readonly promptHintRepository: PromptHintRepository;
  private readonly promptVectorService: PromptVectorService;

  constructor(
    projectId: string,
    promptHintRepository: PromptHintRepository,
    promptVectorService: PromptVectorService
  ) {
    this.projectId = normalizeProjectId(projectId);
    this.promptHintRepository = promptHintRepository;
    this.promptVectorService = promptVectorService;
  }

  async list(): Promise<PromptHintRecord[]> {
    return this.promptHintRepository.listByProjectId(this.projectId);
  }

  async search(text: string, limit: number): Promise<PromptHintSearchResult[]> {
    const normalizedText = normalizeText(text);
    const normalizedLimit = normalizeLimit(limit);
    const vectorResults = await this.promptVectorService.search({
      projectId: this.projectId,
      text: normalizedText,
      limit: normalizedLimit
    });

    return this.hydrateSearchResults(vectorResults, normalizedLimit);
  }

  async searchMany(texts: string[], limit: number): Promise<PromptHintSearchResult[]> {
    const normalizedTexts = normalizeTextArray(texts);
    const normalizedLimit = normalizeLimit(limit);
    const bestByHintId = new Map<string, PromptHintSearchResult>();

    for (const text of normalizedTexts) {
      const vectorResults = await this.promptVectorService.search({
        projectId: this.projectId,
        text,
        limit: normalizedLimit
      });
      const hints = await this.hydrateSearchResults(vectorResults, normalizedLimit);

      for (const hint of hints) {
        const current = bestByHintId.get(hint.id);

        if (!current || hint.score > current.score) {
          bestByHintId.set(hint.id, hint);
        }
      }
    }

    return [...bestByHintId.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, normalizedLimit);
  }

  private async hydrateSearchResults(
    vectorResults: PromptVectorSearchResult[],
    limit: number
  ): Promise<PromptHintSearchResult[]> {
    const hints: PromptHintSearchResult[] = [];
    const seen = new Set<string>();

    for (const result of vectorResults) {
      if (result.projectId !== this.projectId || seen.has(result.hintId)) {
        continue;
      }

      const hint = await this.promptHintRepository.getById(result.hintId, this.projectId);

      if (!hint) {
        continue;
      }

      seen.add(hint.id);
      hints.push({
        ...hint,
        score: result.score
      });

      if (hints.length >= limit) {
        break;
      }
    }

    return hints;
  }

  async add(text: string): Promise<PromptHintRecord> {
    const normalizedText = normalizeText(text);
    const hint = await this.promptHintRepository.create({
      projectId: this.projectId,
      text: normalizedText
    });

    try {
      await this.promptVectorService.add({
        projectId: hint.projectId,
        hintId: hint.id,
        text: hint.text
      });
    } catch (error) {
      await this.promptHintRepository.delete(hint.id);
      throw error;
    }

    return hint;
  }

  async edit(hintId: string, text: string): Promise<PromptHintRecord> {
    const normalizedHintId = normalizeHintId(hintId);
    const normalizedText = normalizeText(text);
    const current = await this.requireHint(normalizedHintId);
    const updated = await this.promptHintRepository.update(normalizedHintId, {
      text: normalizedText
    });

    try {
      await this.promptVectorService.edit({
        projectId: updated.projectId,
        hintId: updated.id,
        text: updated.text
      });
    } catch (error) {
      await this.promptHintRepository.update(current.id, {
        text: current.text
      });
      throw error;
    }

    return updated;
  }

  async delete(hintId: string): Promise<boolean> {
    const normalizedHintId = normalizeHintId(hintId);
    const current = await this.promptHintRepository.getById(normalizedHintId, this.projectId);

    if (!current) {
      return false;
    }

    await this.promptVectorService.delete({
      projectId: current.projectId,
      hintId: current.id
    });

    return this.promptHintRepository.delete(current.id);
  }

  private async requireHint(hintId: string): Promise<PromptHintRecord> {
    const hint = await this.promptHintRepository.getById(hintId, this.projectId);

    if (!hint) {
      throw new Error(`Подсказка ${hintId} для проекта ${this.projectId} не найдена.`);
    }

    return hint;
  }
}

export function createHintContext(
  projectId: string,
  promptHintRepository: PromptHintRepository,
  promptVectorService: PromptVectorService
): HintContext {
  return new HintContext(projectId, promptHintRepository, promptVectorService);
}

function normalizeProjectId(projectId: string): string {
  const normalized = projectId.trim();

  if (!normalized) {
    throw new Error("Project id is required for hint context.");
  }

  return normalized;
}

function normalizeHintId(hintId: string): string {
  const normalized = hintId.trim();

  if (!normalized) {
    throw new Error("Hint id is required for hint context.");
  }

  return normalized;
}

function normalizeText(text: string): string {
  const normalized = text.trim();

  if (!normalized) {
    throw new Error("Hint text is required.");
  }

  return normalized;
}

function normalizeTextArray(texts: string[]): string[] {
  const normalizedTexts = [...new Set(texts.map((text) => normalizeText(text)))];

  if (normalizedTexts.length === 0) {
    throw new Error("At least one hint search text is required.");
  }

  return normalizedTexts;
}

function normalizeLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Hint search limit must be a positive integer.");
  }

  return limit;
}
