/**
 * Lightweight seed error kinds for developer-friendly CLI failures.
 * Avoids leaking secrets (URI credentials, passwords, tokens).
 */

export type SeedErrorKind =
  | 'configuration'
  | 'database'
  | 'validation'
  | 'seed_data'
  | 'integrity'
  | 'unexpected';

const KIND_LABEL: Record<SeedErrorKind, string> = {
  configuration: 'Configuration error',
  database: 'Database connection error',
  validation: 'Validation error',
  seed_data: 'Seed data error',
  integrity: 'Integrity error',
  unexpected: 'Unexpected runtime error',
};

export class SeedError extends Error {
  readonly kind: SeedErrorKind;
  readonly domain: string;

  constructor(kind: SeedErrorKind, domain: string, message: string) {
    super(sanitizeSeedMessage(message));
    this.name = 'SeedError';
    this.kind = kind;
    this.domain = domain;
  }

  get kindLabel(): string {
    return KIND_LABEL[this.kind];
  }
}

/** Strip credentials / connection strings from messages printed to the console. */
export function sanitizeSeedMessage(message: string): string {
  return message
    .replace(/mongodb(\+srv)?:\/\/[^\s"'`]+/gi, 'mongodb://***')
    .replace(/\/\/([^/\s:@]+):([^@/\s]+)@/g, '//***:***@')
    .replace(/(password|passwd|pwd|token|secret|authorization)\s*[:=]\s*\S+/gi, '$1=***');
}

export function printSeedFailure(error: unknown): void {
  console.error('');
  console.error('Seed failed');

  if (error instanceof SeedError) {
    console.error(`Type: ${error.kindLabel}`);
    console.error(`Domain: ${error.domain}`);
    console.error(`Reason: ${error.message}`);
    console.error('');
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Type: Unexpected runtime error');
  console.error('Domain: Runtime');
  console.error(`Reason: ${sanitizeSeedMessage(message)}`);
  console.error('');
}
