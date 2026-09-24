/**
 * Deterministic job safety / fake-job heuristics (sheet 144 + 146).
 * Advisory only — never hides a published job.
 */

export type JobSafetyLevel = 'none' | 'low' | 'medium' | 'high';

export type JobSafetyCode =
  | 'FEE_TO_APPLY'
  | 'PERSONAL_PAYMENT'
  | 'OTP_OR_KYC_SCAM'
  | 'WHATSAPP_ONLY_APPLY'
  | 'UNVERIFIED_EXTREME_SALARY'
  | 'SUSPICIOUS_CONTACT';

export type JobSafetyHints = {
  level: JobSafetyLevel;
  codes: JobSafetyCode[];
  messages: string[];
  /** True when heuristics suggest possible fake/spam listing. */
  suspectedFake: boolean;
};

const FEE_RE =
  /\b(pay\s*(to\s*)?apply|registration\s*fee|joining\s*fee|security\s*deposit|processing\s*fee|application\s*fee)\b/i;
const PAYMENT_RE =
  /\b(upi|gpay|google\s*pay|phonepe|paytm|send\s*money|transfer\s*(rs|inr|money)|wallet)\b/i;
const OTP_RE =
  /\b(otp|one[- ]time\s*password|share\s*(your\s*)?(aadhaar|pan|cvv|atm\s*pin))\b/i;
const WHATSAPP_RE =
  /\b(whatsapp\s*only|apply\s*(on|via|through)\s*whatsapp|wa\.me\/|chat\.whatsapp)\b/i;
const PERSONAL_CONTACT_RE =
  /\b(personal\s*(gmail|email)|@gmail\.com|@yahoo\.com|@hotmail\.com)\b/i;

function collectText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join('\n');
}

function pushUnique(codes: JobSafetyCode[], code: JobSafetyCode) {
  if (!codes.includes(code)) codes.push(code);
}

/**
 * Scan job copy + company verification for client safety banners.
 */
export function computeJobSafetyHints(input: {
  title?: string | null;
  description?: string | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  applicationMethod?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: string | null;
  companyVerificationStatus?: string | null;
}): JobSafetyHints {
  const text = collectText([
    input.title,
    input.description,
    ...(input.responsibilities ?? []),
    ...(input.requirements ?? []),
  ]);

  const codes: JobSafetyCode[] = [];
  const messages: string[] = [];

  if (FEE_RE.test(text)) {
    pushUnique(codes, 'FEE_TO_APPLY');
    messages.push('This listing mentions fees to apply or join — legitimate employers never charge candidates.');
  }
  if (PAYMENT_RE.test(text)) {
    pushUnique(codes, 'PERSONAL_PAYMENT');
    messages.push('Payment app or money-transfer language detected. Do not send money.');
  }
  if (OTP_RE.test(text)) {
    pushUnique(codes, 'OTP_OR_KYC_SCAM');
    messages.push('Requests for OTP or sensitive ID details are a common scam pattern.');
  }
  if (WHATSAPP_RE.test(text) || input.applicationMethod === 'external') {
    if (WHATSAPP_RE.test(text)) {
      pushUnique(codes, 'WHATSAPP_ONLY_APPLY');
      messages.push('WhatsApp-only apply instructions can be risky — prefer in-platform applications.');
    }
  }
  if (PERSONAL_CONTACT_RE.test(text)) {
    pushUnique(codes, 'SUSPICIOUS_CONTACT');
    messages.push('Personal email contacts in the JD may indicate an unofficial posting.');
  }

  const maxSalary = input.salaryMax ?? input.salaryMin ?? null;
  const period = input.salaryPeriod ?? 'monthly';
  const monthlyMax =
    typeof maxSalary === 'number'
      ? period === 'yearly'
        ? maxSalary / 12
        : period === 'daily'
          ? maxSalary * 30
          : period === 'hourly'
            ? maxSalary * 160
            : maxSalary
      : null;

  if (
    monthlyMax != null &&
    monthlyMax >= 200_000 &&
    input.companyVerificationStatus !== 'verified'
  ) {
    pushUnique(codes, 'UNVERIFIED_EXTREME_SALARY');
    messages.push('Very high pay from an unverified company — double-check before sharing documents.');
  }

  let level: JobSafetyLevel = 'none';
  if (codes.length === 1) level = 'low';
  if (codes.length >= 2) level = 'medium';
  if (
    codes.includes('FEE_TO_APPLY') ||
    codes.includes('PERSONAL_PAYMENT') ||
    codes.includes('OTP_OR_KYC_SCAM') ||
    codes.length >= 3
  ) {
    level = 'high';
  }

  return {
    level,
    codes,
    messages,
    suspectedFake:
      codes.includes('FEE_TO_APPLY') ||
      codes.includes('PERSONAL_PAYMENT') ||
      codes.includes('OTP_OR_KYC_SCAM') ||
      codes.includes('UNVERIFIED_EXTREME_SALARY'),
  };
}
