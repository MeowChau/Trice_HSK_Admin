export const HSK_COLORS: Record<
  number,
  { bg: string; text: string; border: string }
> = {
  1: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  2: {
    bg: "bg-teal-50 dark:bg-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-800",
  },
  3: {
    bg: "bg-sky-50 dark:bg-sky-500/10",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-800",
  },
  4: {
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  5: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  6: {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
  },
  7: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
  8: {
    bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    border: "border-fuchsia-200 dark:border-fuchsia-800",
  },
  9: {
    bg: "bg-violet-50 dark:bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800",
  },
};

export const HSK_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);
