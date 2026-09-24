import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { NotificationType } from '../constants/enums';
import { CandidateAlertSettings } from '../models/CandidateAlertSettings';
import { SavedSearch } from '../models/SavedSearch';
import type { AuthenticatedCandidate } from '../types/auth.types';
import { AppError } from '../utils/AppError';
import { mapAlertSettings, mapSavedSearch } from '../utils/savedSearchMapper';
import type {
  AlertSettingsUpdateInput,
  SavedSearchCreateInput,
  SavedSearchQuery,
  SavedSearchUpdateInput,
} from '../validators/savedSearch.validator';

const MAX_SAVED_SEARCHES = 25;

async function getOrCreateSettings(candidateId: string) {
  let settings = await CandidateAlertSettings.findOne({ candidateId });
  if (!settings) {
    settings = await CandidateAlertSettings.create({
      candidateId: new mongoose.Types.ObjectId(candidateId),
    });
  }
  return settings;
}

export class SavedSearchService {
  async list(candidate: AuthenticatedCandidate, query: SavedSearchQuery) {
    const filter: Record<string, unknown> = {
      candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
    };
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      SavedSearch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      SavedSearch.countDocuments(filter),
    ]);
    return {
      savedSearches: items.map(mapSavedSearch),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async create(candidate: AuthenticatedCandidate, input: SavedSearchCreateInput) {
    const count = await SavedSearch.countDocuments({
      candidateId: candidate.candidateId,
    });
    if (count >= MAX_SAVED_SEARCHES) {
      throw new AppError(
        `You can save at most ${MAX_SAVED_SEARCHES} searches`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const doc = await SavedSearch.create({
      candidateId: new mongoose.Types.ObjectId(candidate.candidateId),
      name: input.name,
      filters: input.filters ?? {},
      frequency: input.frequency,
      isActive: input.isActive,
    });

    return { savedSearch: mapSavedSearch(doc) };
  }

  async getById(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    const doc = await SavedSearch.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!doc) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    return { savedSearch: mapSavedSearch(doc) };
  }

  async update(candidate: AuthenticatedCandidate, id: string, input: SavedSearchUpdateInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    const doc = await SavedSearch.findOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (!doc) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    if (input.name !== undefined) doc.name = input.name;
    if (input.filters !== undefined) {
      doc.set('filters', input.filters);
    }
    if (input.frequency !== undefined) doc.frequency = input.frequency;
    if (input.isActive !== undefined) doc.isActive = input.isActive;
    await doc.save();
    return { savedSearch: mapSavedSearch(doc) };
  }

  async remove(candidate: AuthenticatedCandidate, id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    const result = await SavedSearch.deleteOne({
      _id: id,
      candidateId: candidate.candidateId,
    });
    if (result.deletedCount === 0) {
      throw new AppError('Saved search not found', HTTP_STATUS.NOT_FOUND);
    }
    return { deleted: true, id };
  }

  async getAlertSettings(candidate: AuthenticatedCandidate) {
    const settings = await getOrCreateSettings(candidate.candidateId);
    return { settings: mapAlertSettings(settings) };
  }

  async updateAlertSettings(
    candidate: AuthenticatedCandidate,
    input: AlertSettingsUpdateInput,
  ) {
    const settings = await getOrCreateSettings(candidate.candidateId);
    Object.assign(settings, input);
    await settings.save();
    return { settings: mapAlertSettings(settings) };
  }
}

export const savedSearchService = new SavedSearchService();

/** Re-export helper type for alert service. */
export type { NotificationType };
