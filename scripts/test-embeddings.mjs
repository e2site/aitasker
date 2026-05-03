// Этот файл запускает локальную embedding-модель через @xenova/transformers и измеряет скорость получения вектора.
// В файл не входит интеграция embeddings в приложение, скачивание модели и конвертация safetensors в ONNX.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { env, pipeline } from '@xenova/transformers';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..');
const modelDirFromEnv = process.env.EMBEDDINGS_MODEL_DIR ?? 'embeddings';
const absoluteModelDir = path.resolve(repoRoot, modelDirFromEnv);
const modelPathForTransformers = path
  .relative(repoRoot, absoluteModelDir)
  .split(path.sep)
  .join('/');

const requiredModelFiles = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  path.join('onnx', 'model_quantized.onnx'),
];

const text = process.argv.slice(2).join(' ') || 'Тестовый текст для проверки скорости локальной embedding-модели.';
const warmupRuns = parsePositiveInteger(process.env.EMBEDDINGS_WARMUP_RUNS, 1);
const measuredRuns = parsePositiveInteger(process.env.EMBEDDINGS_RUNS, 10);

const missingFiles = requiredModelFiles.filter((fileName) => {
  return !existsSync(path.join(absoluteModelDir, fileName));
});

if (missingFiles.length > 0) {
  printMissingFilesAndExit(missingFiles);
}

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useFSCache = false;
env.localModelPath = `${repoRoot.split(path.sep).join('/')}/`;

const loadStart = performance.now();
const extractor = await pipeline('feature-extraction', modelPathForTransformers, {
  quantized: true,
  local_files_only: true,
});
const loadMs = performance.now() - loadStart;

for (let index = 0; index < warmupRuns; index += 1) {
  await extractor([text]);
}

const times = [];
let embedding = null;

for (let index = 0; index < measuredRuns; index += 1) {
  const startedAt = performance.now();
  embedding = await extractor([text]);
  times.push(performance.now() - startedAt);
}

const vector = Array.from(embedding.data);
const averageMs = times.reduce((sum, value) => sum + value, 0) / times.length;
const minMs = Math.min(...times);
const maxMs = Math.max(...times);

console.log(`Model directory: ${absoluteModelDir}`);
console.log(`Load time: ${formatMs(loadMs)}`);
console.log(`Warmup runs: ${warmupRuns}`);
console.log(`Measured runs: ${measuredRuns}`);
console.log(`Vector shape: [${embedding.dims.join(', ')}]`);
console.log(`Vector length: ${vector.length}`);
console.log(`Inference avg: ${formatMs(averageMs)}`);
console.log(`Inference min: ${formatMs(minMs)}`);
console.log(`Inference max: ${formatMs(maxMs)}`);
console.log(`Vector preview: ${vector.slice(0, 8).map((value) => value.toFixed(6)).join(', ')}`);

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

function printMissingFilesAndExit(missingFilesToPrint) {
  const rootOnnxPath = path.join(absoluteModelDir, 'model_quantized.onnx');
  const nestedOnnxPath = path.join(absoluteModelDir, 'onnx', 'model_quantized.onnx');

  console.error('Не хватает файлов для запуска локальной модели через @xenova/transformers:');
  for (const fileName of missingFilesToPrint) {
    console.error(`- ${path.join(absoluteModelDir, fileName)}`);
  }

  if (existsSync(rootOnnxPath) && !existsSync(nestedOnnxPath)) {
    console.error('');
    console.error('model_quantized.onnx найден в корне embeddings, но библиотека ищет его в embeddings\\onnx\\model_quantized.onnx.');
    console.error('Перемести файл так:');
    console.error('New-Item -ItemType Directory -Force embeddings\\onnx');
    console.error('Move-Item embeddings\\model_quantized.onnx embeddings\\onnx\\model_quantized.onnx');
  }

  if (existsSync(path.join(absoluteModelDir, 'model.safetensors'))) {
    console.error('');
    console.error('model.safetensors для этого теста не нужен: @xenova/transformers запускает ONNX-файл.');
  }

  process.exit(1);
}
