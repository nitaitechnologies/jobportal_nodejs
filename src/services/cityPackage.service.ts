import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import { CityPackage } from '../models/CityPackage';
import { Company } from '../models/Company';
import { CustomProposal } from '../models/CustomProposal';
import { Employer } from '../models/Employer';
import { Subscription } from '../models/Subscription';
import { User } from '../models/User';
import type { AuthenticatedEmployer } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { walletService } from './wallet.service';

export type PackageGrants = {
  jobPosts: number;
  boosts: number;
  unlocks: number;
  createdPoints: number;
};

const DEFAULT_CITIES = ['Delhi', 'Bengaluru', 'Mumbai', 'Hyderabad', 'Pune', 'Noida', 'Gurugram'];

const DEFAULT_TIERS: Array<{
  name: string;
  price: number;
  sortOrder: number;
  grants: PackageGrants;
  description: string;
}> = [
  {
    name: 'Starter',
    price: 2000,
    sortOrder: 1,
    description: '1 job post, 10 boosts, and 50 candidate unlocks for the month.',
    grants: { jobPosts: 1, boosts: 10, unlocks: 50, createdPoints: 0 },
  },
  {
    name: 'Growth',
    price: 4000,
    sortOrder: 2,
    description: '3 job posts, 25 boosts, and 150 candidate unlocks for the month.',
    grants: { jobPosts: 3, boosts: 25, unlocks: 150, createdPoints: 0 },
  },
  {
    name: 'Pro',
    price: 8000,
    sortOrder: 3,
    description: '8 job posts, 50 boosts, and 400 candidate unlocks for the month.',
    grants: { jobPosts: 8, boosts: 50, unlocks: 400, createdPoints: 0 },
  },
  {
    name: 'Business',
    price: 15000,
    sortOrder: 4,
    description: '20 job posts, 100 boosts, and 1000 candidate unlocks for the month.',
    grants: { jobPosts: 20, boosts: 100, unlocks: 1000, createdPoints: 0 },
  },
];

function grantsOf(raw: Partial<PackageGrants> | null | undefined): PackageGrants {
  return {
    jobPosts: Math.max(0, Number(raw?.jobPosts ?? 0)),
    boosts: Math.max(0, Number(raw?.boosts ?? 0)),
    unlocks: Math.max(0, Number(raw?.unlocks ?? 0)),
    createdPoints: Math.max(0, Number(raw?.createdPoints ?? 0)),
  };
}

function mapPackage(row: {
  _id: { toString(): string };
  city: string;
  name: string;
  description?: string | null;
  price: number;
  durationDays?: number | null;
  sortOrder?: number | null;
  status?: string | null;
  grants?: Partial<PackageGrants> | null;
}) {
  return {
    id: row._id.toString(),
    city: row.city,
    name: row.name,
    description: row.description ?? '',
    price: row.price,
    durationDays: row.durationDays ?? 30,
    sortOrder: row.sortOrder ?? 1,
    status: row.status ?? 'active',
    grants: grantsOf(row.grants),
  };
}

function mapProposal(row: {
  _id: { toString(): string };
  companyId: { toString(): string };
  city?: string | null;
  title: string;
  note?: string | null;
  price: number;
  durationDays?: number | null;
  grants?: Partial<PackageGrants> | null;
  status?: string | null;
  paidAt?: Date | null;
  createdAt?: Date | null;
}) {
  return {
    id: row._id.toString(),
    companyId: row.companyId.toString(),
    city: row.city ?? '',
    title: row.title,
    note: row.note ?? '',
    price: row.price,
    durationDays: row.durationDays ?? 30,
    grants: grantsOf(row.grants),
    status: row.status ?? 'pending',
    paidAt: row.paidAt ?? null,
    createdAt: row.createdAt ?? null,
  };
}

let seedPromise: Promise<void> | null = null;

export function ensureDefaultCityPackages() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await CityPackage.countDocuments();
      if (existing > 0) return;
      const docs = DEFAULT_CITIES.flatMap((city) =>
        DEFAULT_TIERS.map((tier) => ({
          city,
          name: `${city} ${tier.name}`,
          description: tier.description,
          price: tier.price,
          durationDays: 30,
          sortOrder: tier.sortOrder,
          status: 'active' as const,
          grants: tier.grants,
        })),
      );
      await CityPackage.insertMany(docs);
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function assertActiveCap(city: string, ignoreId?: string) {
  const filter: Record<string, unknown> = { city, status: 'active' };
  if (ignoreId) filter._id = { $ne: new mongoose.Types.ObjectId(ignoreId) };
  const active = await CityPackage.countDocuments(filter);
  if (active >= 4) {
    throw new AppError(
      `${city} already has 4 active packages. Deactivate one before adding another.`,
      HTTP_STATUS.CONFLICT,
    );
  }
}

export async function companyUsesPackageWallets(companyId: string) {
  const subscription = await Subscription.findOne({
    companyId: new mongoose.Types.ObjectId(companyId),
    status: { $in: ['active', 'trial'] },
    endDate: { $gt: new Date() },
    'features.packageWallets': true,
  }).sort({ createdAt: -1 });
  return Boolean(subscription);
}

export async function activatePackageCredits(input: {
  userId: string;
  companyId: string;
  name: string;
  city: string;
  price: number;
  durationDays: number;
  grants: PackageGrants;
  kind: 'city' | 'custom';
  sourceId: string;
  paymentId?: string;
}) {
  const [user, company, employer] = await Promise.all([
    User.findById(input.userId).select('role status deletedAt'),
    Company.findById(input.companyId).select('status'),
    Employer.findOne({ userId: input.userId, companyId: input.companyId }).select('_id status'),
  ]);
  if (!user || user.role !== 'employer' || user.status !== 'active' || user.deletedAt) {
    throw new AppError('Employer user not found', HTTP_STATUS.NOT_FOUND);
  }
  if (!company || company.status === 'suspended') {
    throw new AppError('Company not found or suspended', HTTP_STATUS.BAD_REQUEST);
  }
  if (!employer || employer.status !== 'active') {
    throw new AppError('Employer profile not found for this company', HTTP_STATUS.BAD_REQUEST);
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
  const grants = grantsOf(input.grants);

  await Subscription.updateMany(
    { companyId: company._id, status: { $in: ['active', 'trial'] } },
    { $set: { status: 'cancelled' } },
  );

  const subscription = await Subscription.create({
    userId: user._id,
    companyId: company._id,
    plan: input.kind === 'custom' ? 'custom-proposal' : 'city-package',
    status: 'active',
    startDate,
    endDate,
    amount: input.price,
    currency: 'INR',
    billingCycle: 'monthly',
    autoRenew: false,
    features: {
      packageWallets: true,
      packageKind: input.kind,
      packageName: input.name,
      city: input.city,
      grants,
      sourceId: input.sourceId,
      candidateContact: true,
      featuredJobs: true,
      advancedCandidateSearch: true,
    },
    limits: {
      jobPostLimit: 100000,
      activeJobLimit: 100000,
      featuredJobLimit: 100000,
      jobListingLifetimeDays: input.durationDays,
      contactUnlockLimit: 100000,
      freeSearchResultLimit: 0,
    },
  });

  const paymentId = input.paymentId;
  const meta = { sourceId: input.sourceId, kind: input.kind };
  await walletService.creditBucket({
    companyId: input.companyId,
    bucket: 'jobPosts',
    credits: grants.jobPosts,
    type: 'purchase',
    paymentId,
    description: `${input.name}: job post credits`,
    metadata: meta,
  });
  await walletService.creditBucket({
    companyId: input.companyId,
    bucket: 'boosts',
    credits: grants.boosts,
    type: 'purchase',
    paymentId,
    description: `${input.name}: boost credits`,
    metadata: meta,
  });
  await walletService.creditBucket({
    companyId: input.companyId,
    bucket: 'unlocks',
    credits: grants.unlocks,
    type: 'purchase',
    paymentId,
    description: `${input.name}: database unlock credits`,
    metadata: meta,
  });
  await walletService.creditBucket({
    companyId: input.companyId,
    bucket: 'createdPoints',
    credits: grants.createdPoints,
    type: 'purchase',
    paymentId,
    description: `${input.name}: created points`,
    metadata: meta,
  });

  return subscription;
}

function cityFromCompany(locations: string[], headquarters: string, known: string[]) {
  const names = [...locations, headquarters].map((item) => item.trim().toLowerCase()).filter(Boolean);
  for (const city of known) {
    const needle = city.toLowerCase();
    if (names.some((name) => name === needle || name.includes(needle))) return city;
  }
  return locations[0]?.trim() || headquarters.trim() || '';
}

export class CityPackageService {
  async listAdmin(city?: string) {
    await ensureDefaultCityPackages();
    const filter = city?.trim() ? { city: new RegExp(`^${city.trim()}$`, 'i') } : {};
    const rows = await CityPackage.find(filter).sort({ city: 1, sortOrder: 1, name: 1 });
    const cities = await CityPackage.distinct('city');
    return { packages: rows.map((row) => mapPackage(row)), cities: cities.sort() };
  }

  async create(input: {
    city: string;
    name: string;
    description?: string;
    price: number;
    durationDays?: number;
    sortOrder?: number;
    grants: PackageGrants;
  }) {
    const city = input.city.trim();
    await assertActiveCap(city);
    const row = await CityPackage.create({
      city,
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      price: input.price,
      durationDays: input.durationDays ?? 30,
      sortOrder: input.sortOrder ?? 1,
      status: 'active',
      grants: grantsOf(input.grants),
    });
    return { package: mapPackage(row) };
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      price: number;
      durationDays: number;
      sortOrder: number;
      status: 'active' | 'inactive';
      grants: PackageGrants;
    }>,
  ) {
    const row = await CityPackage.findById(id);
    if (!row) throw new AppError('City package not found', HTTP_STATUS.NOT_FOUND);
    if (input.status === 'active' && row.status !== 'active') {
      await assertActiveCap(row.city, row._id.toString());
    }
    if (input.name !== undefined) row.name = input.name.trim();
    if (input.description !== undefined) row.description = input.description.trim();
    if (input.price !== undefined) row.price = input.price;
    if (input.durationDays !== undefined) row.durationDays = input.durationDays;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    if (input.status !== undefined) row.status = input.status;
    if (input.grants) row.grants = grantsOf({ ...grantsOf(row.grants), ...input.grants });
    await row.save();
    return { package: mapPackage(row) };
  }

  async searchCompanies(query: string) {
    const q = query.trim();
    if (q.length < 2) return { companies: [] };
    const rows = await Company.find({ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .select('name locations headquarters')
      .limit(8);
    return {
      companies: rows.map((row) => ({
        id: row._id.toString(),
        name: row.name,
        locations: row.locations ?? [],
        headquarters: row.headquarters ?? '',
      })),
    };
  }

  async createProposal(input: {
    companyId: string;
    title: string;
    note?: string;
    price: number;
    durationDays?: number;
    grants: PackageGrants;
    createdBy?: string;
  }) {
    const company = await Company.findById(input.companyId).select('name locations headquarters status');
    if (!company || company.status === 'suspended') {
      throw new AppError('Company not found', HTTP_STATUS.NOT_FOUND);
    }
    await CustomProposal.updateMany(
      { companyId: company._id, status: 'pending' },
      { $set: { status: 'cancelled' } },
    );
    const cities = await CityPackage.distinct('city');
    const city = cityFromCompany(company.locations ?? [], company.headquarters ?? '', cities);
    const row = await CustomProposal.create({
      companyId: company._id,
      city,
      title: input.title.trim(),
      note: input.note?.trim() ?? '',
      price: input.price,
      durationDays: input.durationDays ?? 30,
      grants: grantsOf(input.grants),
      status: 'pending',
      createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : null,
    });
    return { proposal: mapProposal(row), companyName: company.name };
  }

  async listProposals(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const rows = await CustomProposal.find(filter).sort({ createdAt: -1 }).limit(50);
    const companyIds = rows.map((row) => row.companyId);
    const companies = await Company.find({
      _id: { $in: companyIds as mongoose.Types.ObjectId[] },
    }).select('name');
    const names = new Map(companies.map((company) => [company._id.toString(), company.name]));
    return {
      proposals: rows.map((row) => ({
        ...mapProposal(row),
        companyName: names.get(row.companyId.toString()) ?? '',
      })),
    };
  }

  async offerForEmployer(employer: AuthenticatedEmployer) {
    await ensureDefaultCityPackages();
    const company = await Company.findById(employer.companyId).select('locations headquarters');
    const cities = await CityPackage.distinct('city');
    const city = cityFromCompany(company?.locations ?? [], company?.headquarters ?? '', cities);
    const packages = city
      ? await CityPackage.find({ city, status: 'active' }).sort({ sortOrder: 1 }).limit(4)
      : [];
    const proposal = await CustomProposal.findOne({
      companyId: new mongoose.Types.ObjectId(employer.companyId),
      status: 'pending',
    }).sort({ createdAt: -1 });
    const wallet = await walletService.getWallet(employer.companyId);
    return {
      city,
      packages: packages.map((row) => mapPackage(row)),
      proposal: proposal ? mapProposal(proposal) : null,
      wallet: wallet.wallet,
    };
  }

  async quoteCityPackage(employer: AuthenticatedEmployer, packageId: string) {
    const row = await CityPackage.findById(packageId);
    if (!row || row.status !== 'active') {
      throw new AppError('City package not found', HTTP_STATUS.NOT_FOUND);
    }
    const offer = await this.offerForEmployer(employer);
    if (!offer.packages.some((item) => item.id === row._id.toString())) {
      throw new AppError('This package is not available in your city', HTTP_STATUS.FORBIDDEN);
    }
    return row;
  }

  async quoteProposal(employer: AuthenticatedEmployer, proposalId: string) {
    const row = await CustomProposal.findOne({
      _id: proposalId,
      companyId: employer.companyId,
      status: 'pending',
    });
    if (!row) throw new AppError('Custom proposal not found', HTTP_STATUS.NOT_FOUND);
    return row;
  }
}

export const cityPackageService = new CityPackageService();
