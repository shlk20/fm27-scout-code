import { useEffect, useRef } from "react";

/**
 * Returns a ref for a table's scroll container that jumps back to the top
 * whenever `page` changes. Without it, a page change keeps the previous
 * scroll offset, so the new page opens somewhere in the middle of its rows.
 */
export function useScrollTopOnPageChange(page: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [page]);
  return ref;
}
