import { useEffect, useMemo, useState } from "react";

export interface PaginationState<T> {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  /** The slice of `items` for the current page. */
  items: T[];
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}

/**
 * Client-side pagination over an array. Resets to page 1 when the input list
 * shrinks below the current page (e.g. user filters down) so we never get
 * stuck pointing past the end of the array.
 */
export function usePagination<T>(items: T[], initialPageSize = 10): PaginationState<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const slice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  function setPageSize(next: number) {
    setPageSizeRaw(next);
    setPage(1);
  }

  return {
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
    totalItems,
    items: slice,
    setPage,
    setPageSize,
  };
}
