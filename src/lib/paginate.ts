export const PAGE_SIZE = 10;

export const parsePage = (raw: unknown): number => {
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
};

/** Clamps the requested page into range (so deleting the last row of a page never leaves an empty page). */
export function pageInfo(total: number, requested: number) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, requested), totalPages);
  return { page, totalPages, total, offset: (page - 1) * PAGE_SIZE };
}
export type PageInfo = ReturnType<typeof pageInfo>;
