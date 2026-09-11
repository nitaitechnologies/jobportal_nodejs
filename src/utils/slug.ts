/**
 * Convert a display string into a URL-safe slug.
 * Does not guarantee uniqueness — callers must enforce uniqueness.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'company';
}

/**
 * Produce a unique slug by appending -2, -3, ... when needed.
 */
export async function createUniqueSlug(
  baseInput: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(baseInput);
  let candidate = base;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
