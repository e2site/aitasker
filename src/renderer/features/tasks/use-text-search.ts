/*
Назначение: Хук для кастомного поиска по тексту внутри панели задачи с подсветкой совпадений и навигацией.
Не входит: UI строки поиска, рендер подсветки — это в SearchBar и HighlightedText.

Архитектура:
- Все <mark class="search-highlight"> находятся в containerRef
- totalCount = количество таких mark
- currentIndex = порядковый номер активного mark (DOM-порядок)
- Активность выставляется напрямую через DOM-класс "active" (не через React props)
- Scroll выполняется к нужному mark по DOM-порядку
*/
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTextSearchResult {
  query: string;
  setQuery: (q: string) => void;
  currentIndex: number;
  totalCount: number;
  next: () => void;
  prev: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  // ref контейнера где живут все mark (TaskDetailPanel передаёт planTabRef)
  containerRef: React.RefObject<HTMLElement | null>;
  setTotalCount: (count: number) => void;
}

const MARK_SELECTOR = "mark.search-highlight";

export function useTextSearch(): UseTextSearchResult {
  const [query, setQueryState] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // После каждого изменения currentIndex: снять active со всех, выставить нужному, scrollIntoView
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const marks = container.querySelectorAll<HTMLElement>(MARK_SELECTOR);
    console.log(`[useTextSearch] activate effect currentIndex=${currentIndex} marks.length=${marks.length}`);
    marks.forEach((m, i) => {
      if (i === currentIndex) {
        m.classList.add("active");
        m.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        m.classList.remove("active");
      }
    });
  }, [currentIndex]);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    setCurrentIndex(0);
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = totalCount > 0 ? (prev + 1) % totalCount : 0;
      console.log(`[useTextSearch] next: prev=${prev} totalCount=${totalCount} => next=${next}`);
      return next;
    });
  }, [totalCount]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = totalCount > 0 ? (prev - 1 + totalCount) % totalCount : 0;
      console.log(`[useTextSearch] prev: prev=${prev} totalCount=${totalCount} => next=${next}`);
      return next;
    });
  }, [totalCount]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState("");
    setCurrentIndex(0);
    setTotalCount(0);
  }, []);

  return {
    query,
    setQuery,
    currentIndex,
    totalCount,
    next,
    prev,
    isOpen,
    open,
    close,
    containerRef,
    setTotalCount,
  };
}
