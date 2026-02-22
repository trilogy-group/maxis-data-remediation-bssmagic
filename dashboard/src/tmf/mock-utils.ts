/**
 * Mock utilities for MSW handlers
 */

/**
 * Applies pagination (limit and offset) to an array of data.
 *
 * @param data - The readonly array of data to paginate
 * @param limit - Optional maximum number of items to return
 * @param offset - Optional number of items to skip
 * @returns A new array with pagination applied
 */
export function applyPagination<T>(
  data: readonly T[],
  limit?: number,
  offset?: number,
): T[] {
  const startIndex: number = offset !== undefined && offset >= 0 ? offset : 0;
  const endIndex: number =
    limit !== undefined && limit > 0 ? startIndex + limit : data.length;

  return data.slice(startIndex, endIndex);
}
