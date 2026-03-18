/*
Назначение: Рендерит текст с подсветкой совпадений поиска. Совпадения оборачиваются в <mark class="search-highlight">.
Активность (класс "active") управляется напрямую через DOM в useTextSearch — не через React props.
Не входит: Логика поиска, навигация, активация — в useTextSearch.
*/

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countMatches(text: string, query: string): number {
  if (!query) return 0;
  const regex = new RegExp(escapeRegex(query), "gi");
  return (text.match(regex) ?? []).length;
}

interface HighlightedTextProps {
  text: string;
  query: string;
}

export function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) {
    return <>{text}</>;
  }

  const regex = new RegExp(escapeRegex(query), "gi");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <mark key={matchIndex} className="search-highlight">
        {match[0]}
      </mark>
    );
    matchIndex++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
