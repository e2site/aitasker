/*
Назначение: Рендерит и извлекает шаблоны промтов с переменными вида {{varName}}.
Не входит: Хранение шаблонов, IPC-транспорт и UI-компоненты.
*/

export interface PromptVariable {
  name: string;
  value: string;
  placeholder: string;
}

/**
 * Подставляет значения переменных в шаблон.
 * {{varName}} → значение переменной varName.
 */
export function renderPromptTemplate(template: string, vars: PromptVariable[]): string {
  let result = template;
  for (const v of vars) {
    result = result.replaceAll(`{{${v.name}}}`, v.value);
  }
  return result;
}

/**
 * Превращает готовый промт обратно в шаблон, заменяя значения переменных на {{varName}}.
 * Используется при первоначальной генерации шаблона для отображения в редакторе.
 */
export function extractPromptTemplate(promptText: string, vars: PromptVariable[]): string {
  let result = promptText;
  for (const v of vars) {
    if (v.value) {
      result = result.replaceAll(v.value, `{{${v.name}}}`);
    }
  }
  return result;
}

/**
 * Рендерит шаблон, подставляя placeholder-значения для предпросмотра в редакторе.
 */
export function previewPromptTemplate(template: string, vars: PromptVariable[]): string {
  let result = template;
  for (const v of vars) {
    result = result.replaceAll(`{{${v.name}}}`, v.placeholder);
  }
  return result;
}
