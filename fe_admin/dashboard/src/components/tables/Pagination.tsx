type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pageCount = Math.max(1, totalPages);
  const windowSize = Math.min(3, pageCount);
  const startPage = Math.max(
    1,
    Math.min(currentPage - 1, pageCount - windowSize + 1),
  );
  const pages = Array.from(
    { length: windowSize },
    (_, index) => startPage + index,
  );
  const controlClass =
    "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3";

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label="Trang trước"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className={controlClass}
      >
        Trước
      </button>
      {startPage > 1 && (
        <span
          aria-hidden="true"
          className="hidden px-1 text-sm text-gray-500 sm:inline"
        >
          …
        </span>
      )}
      {pages.map((page) => (
        <button
          type="button"
          key={page}
          aria-label={"Trang " + page}
          aria-current={page === currentPage ? "page" : undefined}
          onClick={() => onPageChange(page)}
          className={
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition " +
            (page === currentPage
              ? "bg-brand-500 text-white"
              : "text-gray-700 hover:bg-brand-50 dark:text-gray-300 dark:hover:bg-gray-800")
          }
        >
          {page}
        </button>
      ))}
      {startPage + windowSize - 1 < pageCount && (
        <span
          aria-hidden="true"
          className="hidden px-1 text-sm text-gray-500 sm:inline"
        >
          …
        </span>
      )}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={currentPage >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        className={controlClass}
      >
        Sau
      </button>
    </nav>
  );
}
