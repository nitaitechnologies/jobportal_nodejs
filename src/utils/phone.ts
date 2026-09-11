/**
 * Normalize Indian-style mobile numbers for consistent storage.
 * Keeps digits only; strips leading country code 91 when present with 12 digits.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  return digits;
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}
