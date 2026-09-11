import { Location } from '../../models/Location';
import {
  CITY_DEFS,
  INDIA_STATES,
  UAE_CITIES,
  locationSlug,
} from '../data/locations';
import type { SeedContext, SeedLocationNode } from '../types';

async function upsertLocation(input: {
  name: string;
  slug: string;
  type: 'country' | 'state' | 'city' | 'area';
  parentId: import('mongoose').Types.ObjectId | null;
  countryCode?: string;
  stateCode?: string;
  latitude?: number;
  longitude?: number;
}): Promise<SeedLocationNode> {
  const doc = await Location.findOneAndUpdate(
    { slug: input.slug },
    {
      $set: {
        name: input.name,
        slug: input.slug,
        type: input.type,
        parentId: input.parentId,
        countryCode: input.countryCode ?? '',
        stateCode: input.stateCode ?? '',
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        status: 'active',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    type: doc.type as SeedLocationNode['type'],
    parentId: (doc.parentId as import('mongoose').Types.ObjectId | null) ?? null,
    countryCode: doc.countryCode || undefined,
    stateCode: doc.stateCode || undefined,
  };
}

export async function seedLocations(ctx: SeedContext): Promise<void> {
  const india = await upsertLocation({
    name: 'India',
    slug: locationSlug(['India']),
    type: 'country',
    parentId: null,
    countryCode: 'IN',
  });
  india.countryName = 'India';
  ctx.locations.push(india);

  const uae = await upsertLocation({
    name: 'United Arab Emirates',
    slug: locationSlug(['United Arab Emirates']),
    type: 'country',
    parentId: null,
    countryCode: 'AE',
  });
  uae.countryName = 'United Arab Emirates';
  ctx.locations.push(uae);

  const stateByName = new Map<string, SeedLocationNode>();

  for (const state of INDIA_STATES) {
    const node = await upsertLocation({
      name: state.name,
      slug: locationSlug(['India', state.name]),
      type: 'state',
      parentId: india.id,
      countryCode: 'IN',
      stateCode: state.code,
    });
    node.countryName = 'India';
    node.stateName = state.name;
    stateByName.set(state.name, node);
    ctx.locations.push(node);
  }

  const dubaiState = await upsertLocation({
    name: 'Dubai',
    slug: locationSlug(['United Arab Emirates', 'Dubai']),
    type: 'state',
    parentId: uae.id,
    countryCode: 'AE',
    stateCode: 'DU',
  });
  dubaiState.countryName = 'United Arab Emirates';
  dubaiState.stateName = 'Dubai';
  stateByName.set('Dubai', dubaiState);
  ctx.locations.push(dubaiState);

  for (const city of [...CITY_DEFS, ...UAE_CITIES]) {
    const countryName = city.stateCode === 'DU' ? 'United Arab Emirates' : 'India';
    const countryCode = city.stateCode === 'DU' ? 'AE' : 'IN';
    const state = stateByName.get(city.state);
    if (!state) {
      throw new Error(`Missing state for city ${city.name}`);
    }

    const cityNode = await upsertLocation({
      name: city.name,
      slug: locationSlug([countryName, city.state, city.name]),
      type: 'city',
      parentId: state.id,
      countryCode,
      stateCode: city.stateCode,
      latitude: city.lat,
      longitude: city.lng,
    });
    cityNode.cityName = city.name;
    cityNode.stateName = city.state;
    cityNode.countryName = countryName;
    cityNode.displayName = `${city.name}, ${city.state}, ${countryName}`;
    ctx.locations.push(cityNode);
    ctx.cities.push(cityNode);

    for (const area of city.areas) {
      const areaNode = await upsertLocation({
        name: area.name,
        slug: locationSlug([countryName, city.state, city.name, area.name]),
        type: 'area',
        parentId: cityNode.id,
        countryCode,
        stateCode: city.stateCode,
        latitude: area.lat,
        longitude: area.lng,
      });
      areaNode.cityName = city.name;
      areaNode.stateName = city.state;
      areaNode.countryName = countryName;
      areaNode.displayName = `${area.name}, ${city.name}, ${city.state}`;
      ctx.locations.push(areaNode);
      ctx.areas.push(areaNode);
    }
  }

  ctx.summary.locations = ctx.locations.length;
}
