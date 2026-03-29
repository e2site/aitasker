/*
Назначение: Overlay-компонент строки поиска для вкладки «План». Показывает input, кнопки навигации,
счётчик совпадений и кнопку закрытия. Открывается по Ctrl+F, закрывается по Escape.
Не входит: Логика поиска и подсветки — в useTextSearch и HighlightedText.
*/
import { useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";

interface SearchBarProps {
  query: string;
  currentIndex: number;
  totalCount: number;
  onQueryChange: (q: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function SearchBar({
  query,
  currentIndex,
  totalCount,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasQuery = query.length > 0;
  const noMatches = hasQuery && totalCount === 0;

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border bg-background px-2 py-1.5 shadow-lg">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
              onPrev();
            } else {
              onNext();
            }
          }
          if (e.key === "Escape") {
            onClose();
          }
        }}
        placeholder="Найти..."
        className={`w-44 rounded-lg border px-2 py-1 text-sm outline-none transition ${
          noMatches
            ? "border-rose-300 bg-rose-50 text-rose-700 placeholder:text-rose-300 focus:ring-1 focus:ring-rose-300"
            : "border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/30"
        }`}
      />
      {hasQuery && (
        <span className="min-w-[44px] text-center text-xs text-muted-foreground">
          {totalCount === 0 ? "0 / 0" : `${currentIndex + 1} / ${totalCount}`}
        </span>
      )}
      <button
        type="button"
        title="Предыдущее совпадение (Shift+Enter)"
        disabled={totalCount === 0}
        onClick={onPrev}
        className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronUp className="size-4" />
      </button>
      <button
        type="button"
        title="Следующее совпадение (Enter)"
        disabled={totalCount === 0}
        onClick={onNext}
        className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronDown className="size-4" />
      </button>
      <button
        type="button"
        title="Закрыть (Escape)"
        onClick={onClose}
        className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
