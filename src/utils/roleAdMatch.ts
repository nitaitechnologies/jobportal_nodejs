function parts(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

const GENERIC_TOKENS = new Set([
  'developer',
  'development',
  'engineer',
  'engineering',
  'executive',
  'manager',
  'management',
  'specialist',
  'associate',
  'senior',
  'junior',
  'lead',
  'intern',
  'fresher',
  'role',
  'level',
  'experience',
  'years',
  'year',
  'relevant',
  'knowledge',
  'domain',
  'skill',
  'skills',
  'writer',
  'officer',
  'consultant',
]);

function significantTokens(value: string): string[] {
  return parts(value).filter((part) => part.length >= 3 && !GENERIC_TOKENS.has(part));
}

/**
 * True when an AI skill gap or job title lines up with a roles-master category.
 * "Frontend Developer" matches "Frontend Development". "Java" does not match "JavaScript".
 */
export function skillMatchesRole(
  skill: string,
  role: { name: string; slug: string },
): boolean {
  const skillParts = parts(skill);
  const skillKey = skillParts.join('');
  if (skillKey.length < 3) return false;
  const nameParts = parts(role.name);
  const slugParts = parts(role.slug);
  const nameKey = nameParts.join('');
  const slugKey = slugParts.join('');
  const roleParts = [...nameParts, ...slugParts];

  if (skillKey.length >= 3 && (skillKey === nameKey || skillKey === slugKey)) return true;

  const startsOnBoundary = (key: string, sourceParts: string[]) => {
    if (skillKey.length < 4 || !key.startsWith(skillKey) || key === skillKey) return false;
    return sourceParts.some((_, index) => sourceParts.slice(0, index + 1).join('') === skillKey);
  };

  if (startsOnBoundary(nameKey, nameParts) || startsOnBoundary(slugKey, slugParts)) return true;

  if (skillParts.every((part) => roleParts.includes(part))) return true;

  const skillTokens = new Set(significantTokens(skill));
  if (skillTokens.size === 0) return false;
  return significantTokens(`${role.name} ${role.slug}`).some((token) => skillTokens.has(token));
}

/** Normalize a skill or role label so "Next.js" and "nextjs" compare equal. */
export function normalizeRoleKey(value: string): string {
  return parts(value).join('');
}
