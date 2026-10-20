/** Shared ownership predicate used before any document or job data is returned. */
export function isResourceOwner(resourceUserId: string, requestUserId: string): boolean {
  return Boolean(resourceUserId && requestUserId && resourceUserId === requestUserId);
}
