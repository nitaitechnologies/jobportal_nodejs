import mongoose from 'mongoose';
import { HTTP_STATUS } from '../constants';
import type { LocationType } from '../constants/enums';
import { Job } from '../models/Job';
import { Location } from '../models/Location';
import { AppError } from '../utils/AppError';
import {
  mapAdminLocation,
  mapPublicLocationDetail,
  mapPublicLocationSummary,
} from '../utils/locationMapper';
import { createUniqueSlug, slugify } from '../utils/slug';
import type {
  AdminLocationQuery,
  LocationCreateInput,
  LocationUpdateInput,
  PublicLocationQuery,
} from '../validators/location.validator';

const PARENT_TYPE_BY_CHILD: Record<LocationType, LocationType | null> = {
  country: null,
  state: 'country',
  city: 'state',
  area: 'city',
};

interface LocationFilter {
  status?: 'active' | 'inactive';
  type?: LocationType;
  name?: { $regex: string; $options: string };
  slug?: string;
  parentId?: mongoose.Types.ObjectId | null | { $in: mongoose.Types.ObjectId[] };
  _id?: { $ne: mongoose.Types.ObjectId };
  $or?: Array<Record<string, unknown>>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collect each root location id plus all active descendants (BFS).
 * Used so city job counts include jobs posted on child areas.
 */
async function collectActiveSubtreeMap(
  rootIds: mongoose.Types.ObjectId[],
): Promise<Map<string, mongoose.Types.ObjectId[]>> {
  const subtreeByRoot = new Map<string, mongoose.Types.ObjectId[]>();
  const rootOf = new Map<string, string>();

  for (const rootId of rootIds) {
    const key = rootId.toString();
    subtreeByRoot.set(key, [rootId]);
    rootOf.set(key, key);
  }

  let frontier = [...rootIds];
  while (frontier.length > 0) {
    const children = await Location.find({
      parentId: { $in: frontier },
      status: 'active',
    }).select('_id parentId');

    frontier = [];
    for (const child of children) {
      if (!child.parentId) {
        continue;
      }
      const parentKey = child.parentId.toString();
      const rootKey = rootOf.get(parentKey);
      if (!rootKey) {
        continue;
      }
      rootOf.set(child._id.toString(), rootKey);
      subtreeByRoot.get(rootKey)?.push(child._id);
      frontier.push(child._id);
    }
  }

  return subtreeByRoot;
}

/** Published job counts rolled up to each requested location (includes descendants). */
async function getPublishedJobCountsForLocations(
  locationIds: mongoose.Types.ObjectId[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (locationIds.length === 0) {
    return counts;
  }

  const subtreeByRoot = await collectActiveSubtreeMap(locationIds);
  const allLocationIds = Array.from(
    new Set(
      Array.from(subtreeByRoot.values()).flatMap((ids) => ids.map((id) => id.toString())),
    ),
  ).map((id) => new mongoose.Types.ObjectId(id));

  const rows = await Job.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    {
      $match: {
        status: 'published',
        deletedAt: null,
        'location.locationId': { $in: allLocationIds },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
    },
    {
      $group: {
        _id: '$location.locationId',
        count: { $sum: 1 },
      },
    },
  ]);

  const directCounts = new Map(
    rows.map((row) => [row._id.toString(), row.count] as const),
  );

  for (const [rootKey, subtreeIds] of subtreeByRoot) {
    let total = 0;
    for (const id of subtreeIds) {
      total += directCounts.get(id.toString()) ?? 0;
    }
    counts.set(rootKey, total);
  }

  return counts;
}

function parseParentFilter(parentId?: string): LocationFilter {
  if (!parentId) {
    return {};
  }
  if (parentId === 'null' || parentId === 'root') {
    return { $or: [{ parentId: null }, { parentId: { $exists: false } }] };
  }
  return { parentId: new mongoose.Types.ObjectId(parentId) };
}

async function uniqueLocationSlug(nameOrSlug: string, excludeId?: string): Promise<string> {
  return createUniqueSlug(nameOrSlug, async (value) => {
    const query: LocationFilter = { slug: value };
    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existing = await Location.findOne(query).select('_id');
    return Boolean(existing);
  });
}

async function assertNoDuplicateName(
  name: string,
  parentId: string | null,
  excludeId?: string,
): Promise<void> {
  const filter: LocationFilter = {
    name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' },
  };

  if (parentId) {
    filter.parentId = new mongoose.Types.ObjectId(parentId);
  } else {
    filter.$or = [{ parentId: null }, { parentId: { $exists: false } }];
  }

  if (excludeId) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }

  const existing = await Location.findOne(filter).select('_id name');
  if (existing) {
    throw new AppError(
      'A location with this name already exists under the same parent',
      HTTP_STATUS.CONFLICT,
    );
  }
}

async function assertValidParentForType(
  type: LocationType,
  parentId: string | null,
  selfId?: string,
): Promise<void> {
  const expectedParentType = PARENT_TYPE_BY_CHILD[type];

  if (expectedParentType === null) {
    if (parentId) {
      throw new AppError('A country cannot have a parent', HTTP_STATUS.CONFLICT);
    }
    return;
  }

  if (!parentId) {
    throw new AppError(`${type} requires a parent`, HTTP_STATUS.BAD_REQUEST);
  }

  if (selfId && parentId === selfId) {
    throw new AppError('A location cannot be its own parent', HTTP_STATUS.CONFLICT);
  }

  const parent = await Location.findById(parentId);
  if (!parent) {
    throw new AppError('Parent location not found', HTTP_STATUS.BAD_REQUEST);
  }

  if (parent.type !== expectedParentType) {
    throw new AppError(
      `Parent of a ${type} must be a ${expectedParentType}`,
      HTTP_STATUS.CONFLICT,
    );
  }

  if (selfId) {
    let cursor: typeof parent | null = parent;
    const visited = new Set<string>([selfId]);
    while (cursor) {
      const cursorId = cursor._id.toString();
      if (visited.has(cursorId)) {
        throw new AppError('Circular location hierarchy is not allowed', HTTP_STATUS.CONFLICT);
      }
      visited.add(cursorId);
      if (!cursor.parentId) {
        break;
      }
      cursor = await Location.findById(cursor.parentId);
    }
  }
}

export class LocationService {
  async listPublic(query: PublicLocationQuery) {
    const filter: LocationFilter = {
      status: 'active',
      ...parseParentFilter(query.parentId),
    };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      Location.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit),
      Location.countDocuments(filter),
    ]);

    const jobCounts = await getPublishedJobCountsForLocations(items.map((item) => item._id));

    return {
      locations: items.map((item) =>
        mapPublicLocationSummary(item, {
          jobCount: jobCounts.get(item._id.toString()) ?? 0,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getPublicBySlug(slug: string) {
    const location = await Location.findOne({
      slug: slug.trim().toLowerCase(),
      status: 'active',
    });

    if (!location) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const [parent, children] = await Promise.all([
      location.parentId
        ? Location.findOne({ _id: location.parentId, status: 'active' }).select(
            'name slug type',
          )
        : Promise.resolve(null),
      Location.find({ parentId: location._id, status: 'active' }).sort({ name: 1 }),
    ]);

    const countTargets = [location._id, ...children.map((child) => child._id)];
    const jobCounts = await getPublishedJobCountsForLocations(countTargets);

    return {
      location: mapPublicLocationDetail(location, {
        parent,
        children,
        jobCount: jobCounts.get(location._id.toString()) ?? 0,
        childJobCounts: jobCounts,
      }),
    };
  }

  async getPublicChildren(slug: string) {
    const parent = await Location.findOne({
      slug: slug.trim().toLowerCase(),
      status: 'active',
    });

    if (!parent) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const children = await Location.find({
      parentId: parent._id,
      status: 'active',
    }).sort({ name: 1 });

    const countTargets = [parent._id, ...children.map((child) => child._id)];
    const jobCounts = await getPublishedJobCountsForLocations(countTargets);

    return {
      parent: mapPublicLocationSummary(parent, {
        jobCount: jobCounts.get(parent._id.toString()) ?? 0,
      }),
      children: children.map((child) =>
        mapPublicLocationSummary(child, {
          jobCount: jobCounts.get(child._id.toString()) ?? 0,
        }),
      ),
    };
  }

  async create(input: LocationCreateInput) {
    const parentId = input.parentId ?? null;
    await assertValidParentForType(input.type, parentId);
    await assertNoDuplicateName(input.name, parentId);

    const slugSource = input.slug?.trim() ? slugify(input.slug) : input.name;
    const slug = await uniqueLocationSlug(slugSource);

    try {
      const location = await Location.create({
        name: input.name,
        slug,
        type: input.type,
        parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
        countryCode: input.countryCode ?? '',
        stateCode: input.stateCode ?? '',
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        status: input.status ?? 'active',
      });

      return { location: mapAdminLocation(location, { childCount: 0 }) };
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        throw new AppError(
          'A location with this name or slug already exists',
          HTTP_STATUS.CONFLICT,
        );
      }
      throw error;
    }
  }

  async listAdmin(query: AdminLocationQuery) {
    const filter: LocationFilter = {
      ...parseParentFilter(query.parentId),
    };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    const sortDirection = query.sortOrder === 'desc' ? -1 : 1;
    const sort: Record<string, 1 | -1> =
      query.sortBy === 'type'
        ? { type: sortDirection, name: 1 }
        : query.sortBy === 'createdAt'
          ? { createdAt: sortDirection }
          : { name: sortDirection };

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      Location.find(filter).sort(sort).skip(skip).limit(query.limit),
      Location.countDocuments(filter),
    ]);

    const parentIds = items
      .map((item) => item.parentId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));

    const parents = parentIds.length
      ? await Location.find({ _id: { $in: parentIds } }).select('name slug type')
      : [];
    const parentMap = new Map(parents.map((parent) => [parent._id.toString(), parent]));

    const childCounts =
      items.length === 0
        ? []
        : await Location.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            { $match: { parentId: { $in: items.map((item) => item._id) } } },
            { $group: { _id: '$parentId', count: { $sum: 1 } } },
          ]);
    const childCountMap = new Map(
      childCounts.map((row) => [row._id.toString(), row.count]),
    );

    return {
      locations: items.map((item) =>
        mapAdminLocation(item, {
          parent: item.parentId ? parentMap.get(item.parentId.toString()) ?? null : null,
          childCount: childCountMap.get(item._id.toString()) ?? 0,
        }),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getAdminById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const location = await Location.findById(id);
    if (!location) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const [parent, childCount] = await Promise.all([
      location.parentId
        ? Location.findById(location.parentId).select('name slug type')
        : Promise.resolve(null),
      Location.countDocuments({ parentId: location._id }),
    ]);

    return {
      location: mapAdminLocation(location, { parent, childCount }),
    };
  }

  async update(id: string, input: LocationUpdateInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const location = await Location.findById(id);
    if (!location) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const nextType = (input.type ?? location.type) as LocationType;
    const nextParentId =
      input.parentId !== undefined
        ? input.parentId
        : location.parentId
          ? location.parentId.toString()
          : null;
    const nextName = input.name ?? location.name;

    if (input.type !== undefined && input.type !== location.type) {
      const childCount = await Location.countDocuments({ parentId: location._id });
      if (childCount > 0) {
        throw new AppError(
          'Cannot change type while the location has child locations',
          HTTP_STATUS.CONFLICT,
        );
      }
    }

    if (input.type !== undefined || input.parentId !== undefined) {
      await assertValidParentForType(nextType, nextParentId, id);
    }

    if (
      input.name !== undefined ||
      input.parentId !== undefined ||
      (input.name === undefined && input.parentId !== undefined)
    ) {
      const nameChanged =
        input.name !== undefined &&
        input.name.trim().toLowerCase() !== location.name.trim().toLowerCase();
      const parentChanged =
        input.parentId !== undefined &&
        (input.parentId ?? null) !== (location.parentId?.toString() ?? null);

      if (nameChanged || parentChanged) {
        await assertNoDuplicateName(nextName, nextParentId, id);
      }
    }

    if (input.parentId !== undefined) {
      location.parentId = input.parentId
        ? new mongoose.Types.ObjectId(input.parentId)
        : null;
    }
    if (input.type !== undefined) {
      location.type = input.type;
    }
    if (input.name !== undefined) {
      location.name = input.name;
      // Slug stays stable for public SEO URLs.
    }
    if (input.countryCode !== undefined) {
      location.countryCode = input.countryCode;
    }
    if (input.stateCode !== undefined) {
      location.stateCode = input.stateCode;
    }
    if (input.latitude !== undefined) {
      location.latitude = input.latitude === null ? undefined : input.latitude;
    }
    if (input.longitude !== undefined) {
      location.longitude = input.longitude === null ? undefined : input.longitude;
    }
    if (input.status !== undefined) {
      location.status = input.status;
    }

    try {
      await location.save();
    } catch (error) {
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        throw new AppError(
          'A location with this name or slug already exists',
          HTTP_STATUS.CONFLICT,
        );
      }
      throw error;
    }

    const [parent, childCount] = await Promise.all([
      location.parentId
        ? Location.findById(location.parentId).select('name slug type')
        : Promise.resolve(null),
      Location.countDocuments({ parentId: location._id }),
    ]);

    return {
      location: mapAdminLocation(location, { parent, childCount }),
    };
  }

  async remove(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const location = await Location.findById(id);
    if (!location) {
      throw new AppError('Location not found', HTTP_STATUS.NOT_FOUND);
    }

    const [childCount, jobCount] = await Promise.all([
      Location.countDocuments({ parentId: location._id }),
      Job.countDocuments({ 'location.locationId': location._id }),
    ]);

    if (childCount > 0 || jobCount > 0) {
      location.status = 'inactive';
      await location.save();

      return {
        deleted: false,
        deactivated: true,
        id: location._id.toString(),
        status: location.status,
        reason: `Location has dependencies (${childCount} children, ${jobCount} jobs) and was deactivated instead of deleted`,
      };
    }

    await Location.deleteOne({ _id: location._id });

    return {
      deleted: true,
      deactivated: false,
      id: location._id.toString(),
    };
  }
}

export const locationService = new LocationService();
