import path from 'path';
import { createRequire } from 'module';
import { SarkariJob, buildSarkariSlug } from '../models/SarkariJob';
import { toPublicSarkariJob, type PublicSarkariJob } from '../utils/sarkariJobMapper';
import { AppError } from '../utils/AppError';
import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';

const requireFromHere = createRequire(__filename);

function resolveScraperPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'integrations', 'sarkari', 'scraper.js'),
    path.join(process.cwd(), 'src', 'integrations', 'sarkari', 'scraper.js'),
    path.join(process.cwd(), 'dist', 'integrations', 'sarkari', 'scraper.js'),
  ];
  const fs = requireFromHere('fs') as typeof import('fs');
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Sarkari scraper module not found');
}

type ScrapedJob = {
  id: string;
  title: string;
  url?: string;
  sourceUrl?: string;
  postName?: string | null;
  department?: string | null;
  board?: string | null;
  notificationNumber?: string | null;
  notificationDate?: string | null;
  applicationStartDate?: string | null;
  applicationLastDate?: string | null;
  feeLastDate?: string | null;
  examDate?: string | null;
  admitCardDate?: string | null;
  totalVacancies?: number | string | null;
  categoryWiseVacancies?: unknown;
  postWiseVacancies?: Array<{ post: string; vacancies: number }> | null;
  location?: string | null;
  eligibility?: Record<string, string | null>;
  applicationFee?: string | null;
  paymentMode?: string | null;
  selectionProcess?: unknown;
  salary?: string | null;
  documentsRequired?: string | null;
  applicationSteps?: string | null;
  notificationPdfUrl?: string | null;
  applyOnlineUrl?: string | null;
  shortInformation?: string | null;
  listingDate?: string | null;
  publishedAt?: string | null;
  lastVerifiedAt?: string | null;
};

type ListQuery = {
  page: number;
  limit: number;
  q?: string;
  sort?: 'latest' | 'closingSoon';
};

let syncInFlight: Promise<{ upserted: number; total: number }> | null = null;

function loadScraper(): {
  scrapeJobs: (opts: {
    sourceUrl: string;
    timeoutMs: number;
    detailLimit: number;
    detailConcurrency: number;
  }) => Promise<ScrapedJob[]>;
} {
  return requireFromHere(resolveScraperPath()) as {
    scrapeJobs: (opts: {
      sourceUrl: string;
      timeoutMs: number;
      detailLimit: number;
      detailConcurrency: number;
    }) => Promise<ScrapedJob[]>;
  };
}

function mapScrapedToUpdate(job: ScrapedJob) {
  const sourceUrl = job.sourceUrl || job.url || '';
  return {
    externalId: job.id,
    slug: buildSarkariSlug(job.title, job.id),
    title: job.title,
    postName: job.postName ?? job.title,
    department: job.department ?? null,
    board: job.board ?? null,
    notificationNumber: job.notificationNumber ?? null,
    notificationDate: job.notificationDate ?? null,
    applicationStartDate: job.applicationStartDate ?? null,
    applicationLastDate: job.applicationLastDate ?? null,
    feeLastDate: job.feeLastDate ?? null,
    examDate: job.examDate ?? null,
    admitCardDate: job.admitCardDate ?? null,
    totalVacancies: job.totalVacancies ?? null,
    categoryWiseVacancies: job.categoryWiseVacancies ?? null,
    postWiseVacancies: job.postWiseVacancies ?? [],
    location: job.location ?? null,
    eligibility: job.eligibility ?? {},
    applicationFee: job.applicationFee ?? null,
    paymentMode: job.paymentMode ?? null,
    selectionProcess: job.selectionProcess ?? null,
    salary: job.salary ?? null,
    documentsRequired: job.documentsRequired ?? null,
    applicationSteps: job.applicationSteps ?? null,
    notificationPdfUrl: job.notificationPdfUrl ?? null,
    applyOnlineUrl: job.applyOnlineUrl ?? null,
    shortInformation: job.shortInformation ?? null,
    listingDate: job.listingDate ?? null,
    publishedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    lastVerifiedAt: job.lastVerifiedAt ? new Date(job.lastVerifiedAt) : new Date(),
    sourceUrl,
    isActive: true,
  };
}

export class SarkariJobService {
  async syncFromSource(): Promise<{ upserted: number; total: number }> {
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      if (!env.sarkariSyncEnabled) {
        throw new AppError('Sarkari sync is disabled', HTTP_STATUS.FORBIDDEN);
      }

      const { scrapeJobs } = loadScraper();
      const scraped = await scrapeJobs({
        sourceUrl: env.sarkariSourceUrl,
        timeoutMs: env.sarkariRequestTimeoutMs,
        detailLimit: env.sarkariDetailFetchLimit,
        detailConcurrency: env.sarkariDetailConcurrency,
      });

      let upserted = 0;
      for (const job of scraped) {
        if (!job?.id || !job?.title) continue;
        const payload = mapScrapedToUpdate(job);
        if (!payload.sourceUrl) continue;

        await SarkariJob.findOneAndUpdate(
          { externalId: payload.externalId },
          { $set: payload },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
        );
        upserted += 1;
      }

      return { upserted, total: scraped.length };
    })().finally(() => {
      syncInFlight = null;
    });

    return syncInFlight;
  }

  async listPublic(query: ListQuery): Promise<{
    items: PublicSarkariJob[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const filter: Record<string, unknown> = { isActive: true };
    if (query.q?.trim()) {
      filter.$text = { $search: query.q.trim() };
    }

    const sort: Record<string, 1 | -1> =
      query.sort === 'closingSoon'
        ? { applicationLastDate: 1, publishedAt: -1 }
        : { publishedAt: -1, createdAt: -1 };

    const page = Math.max(1, query.page);
    const limit = Math.min(50, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      SarkariJob.countDocuments(filter),
      SarkariJob.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    return {
      items: rows.map((row) => toPublicSarkariJob(row as never)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getPublicBySlug(slug: string): Promise<PublicSarkariJob> {
    const row = await SarkariJob.findOne({ slug, isActive: true }).lean();
    if (!row) {
      throw new AppError('Sarkari job not found', HTTP_STATUS.NOT_FOUND);
    }
    return toPublicSarkariJob(row as never);
  }

  async countActive(): Promise<number> {
    return SarkariJob.countDocuments({ isActive: true });
  }
}

export const sarkariJobService = new SarkariJobService();
