import type { ISarkariJob } from '../models/SarkariJob';

const HIDDEN_HOST_PATTERN = /sarkariresult/i;

/** Strip aggregator / scrape-origin URLs so candidates never see the data source. */
export function sanitizePublicUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (HIDDEN_HOST_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export type PublicSarkariJob = {
  id: string;
  slug: string;
  title: string;
  postName: string | null;
  department: string | null;
  board: string | null;
  notificationNumber: string | null;
  notificationDate: string | null;
  applicationStartDate: string | null;
  applicationLastDate: string | null;
  feeLastDate: string | null;
  examDate: string | null;
  admitCardDate: string | null;
  totalVacancies: number | string | null;
  categoryWiseVacancies: unknown;
  postWiseVacancies: Array<{ post: string; vacancies: number }> | null;
  location: string | null;
  eligibility: {
    education: string | null;
    minAge: string | null;
    maxAge: string | null;
    ageRelaxation: string | null;
    experience: string | null;
    nationality: string | null;
  };
  applicationFee: string | null;
  paymentMode: string | null;
  selectionProcess: unknown;
  salary: string | null;
  documentsRequired: string | null;
  applicationSteps: string | null;
  notificationPdfUrl: string | null;
  applyOnlineUrl: string | null;
  shortInformation: string | null;
  listingDate: string | null;
  publishedAt: string | null;
  lastVerifiedAt: string | null;
};

type SarkariDoc = ISarkariJob & { _id: { toString(): string } };

export function toPublicSarkariJob(doc: SarkariDoc): PublicSarkariJob {
  const eligibility = (doc.eligibility ?? {}) as Record<string, string | null | undefined>;
  const postWise = Array.isArray(doc.postWiseVacancies) ? doc.postWiseVacancies : [];

  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    postName: doc.postName ?? null,
    department: doc.department ?? null,
    board: doc.board ?? null,
    notificationNumber: doc.notificationNumber ?? null,
    notificationDate: doc.notificationDate ?? null,
    applicationStartDate: doc.applicationStartDate ?? null,
    applicationLastDate: doc.applicationLastDate ?? null,
    feeLastDate: doc.feeLastDate ?? null,
    examDate: doc.examDate ?? null,
    admitCardDate: doc.admitCardDate ?? null,
    totalVacancies: (doc.totalVacancies as number | string | null) ?? null,
    categoryWiseVacancies: doc.categoryWiseVacancies ?? null,
    postWiseVacancies: postWise.length
      ? postWise.map((row) => ({ post: row.post, vacancies: row.vacancies }))
      : null,
    location: doc.location ?? null,
    eligibility: {
      education: eligibility.education ?? null,
      minAge: eligibility.minAge ?? null,
      maxAge: eligibility.maxAge ?? null,
      ageRelaxation: eligibility.ageRelaxation ?? null,
      experience: eligibility.experience ?? null,
      nationality: eligibility.nationality ?? null,
    },
    applicationFee: doc.applicationFee ?? null,
    paymentMode: doc.paymentMode ?? null,
    selectionProcess: doc.selectionProcess ?? null,
    salary: doc.salary ?? null,
    documentsRequired: doc.documentsRequired ?? null,
    applicationSteps: doc.applicationSteps ?? null,
    notificationPdfUrl: sanitizePublicUrl(doc.notificationPdfUrl),
    applyOnlineUrl: sanitizePublicUrl(doc.applyOnlineUrl),
    shortInformation: doc.shortInformation ?? null,
    listingDate: doc.listingDate ?? null,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
    lastVerifiedAt: doc.lastVerifiedAt ? new Date(doc.lastVerifiedAt).toISOString() : null,
  };
}
