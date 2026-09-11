import type { Types } from 'mongoose';
import type { LocationType } from '../constants/enums';

export interface LocationLike {
  _id: Types.ObjectId | { toString(): string };
  name: string;
  slug: string;
  type: LocationType | string;
  parentId?: Types.ObjectId | null;
  countryCode?: string | null;
  stateCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

function mapParentSummary(parent: LocationLike | null | undefined) {
  if (!parent) {
    return null;
  }
  return {
    id: parent._id.toString(),
    name: parent.name,
    slug: parent.slug,
    type: parent.type,
  };
}

export function mapPublicLocationSummary(
  location: LocationLike,
  extras?: { jobCount?: number },
) {
  return {
    id: location._id.toString(),
    name: location.name,
    slug: location.slug,
    type: location.type,
    parentId: location.parentId ? location.parentId.toString() : null,
    countryCode: location.countryCode ?? '',
    stateCode: location.stateCode ?? '',
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    jobCount: extras?.jobCount ?? 0,
  };
}

export function mapPublicLocationDetail(
  location: LocationLike,
  extras?: {
    parent?: LocationLike | null;
    children?: LocationLike[];
    jobCount?: number;
    childJobCounts?: Map<string, number>;
  },
) {
  return {
    ...mapPublicLocationSummary(location, { jobCount: extras?.jobCount }),
    parent: mapParentSummary(extras?.parent ?? null),
    children: (extras?.children ?? []).map((child) =>
      mapPublicLocationSummary(child, {
        jobCount: extras?.childJobCounts?.get(child._id.toString()) ?? 0,
      }),
    ),
  };
}

export function mapAdminLocation(
  location: LocationLike,
  extras?: {
    parent?: LocationLike | null;
    childCount?: number;
  },
) {
  return {
    id: location._id.toString(),
    name: location.name,
    slug: location.slug,
    type: location.type,
    parentId: location.parentId ? location.parentId.toString() : null,
    parent: mapParentSummary(extras?.parent ?? null),
    countryCode: location.countryCode ?? '',
    stateCode: location.stateCode ?? '',
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    status: location.status,
    childCount: extras?.childCount ?? 0,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}
