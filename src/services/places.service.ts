import { HTTP_STATUS } from '../constants';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export type PlaceSuggestion = {
  placeId: string;
  label: string;
};

export type ResolvedPlace = {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  area: string;
  country: string;
};

type AddressParts = {
  city?: string;
  state?: string;
  area?: string;
  country?: string;
};

const detailsCache = new Map<string, ResolvedPlace>();

function googleKey(): string {
  return env.googleMapsApiKey.trim();
}

async function readJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'WorkIndia/1.0 (job portal location search)',
      ...headers,
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new AppError('Location search failed', HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class PlacesService {
  async autocomplete(query: string): Promise<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    if (googleKey()) return this.googleAutocomplete(q);
    return this.nominatimAutocomplete(q);
  }

  async resolve(placeId: string): Promise<ResolvedPlace> {
    const id = placeId.trim();
    if (!id) {
      throw new AppError('placeId is required', HTTP_STATUS.BAD_REQUEST);
    }
    const cached = detailsCache.get(id);
    if (cached) return cached;

    const place = id.startsWith('osm:')
      ? await this.nominatimResolve(id)
      : await this.googleResolve(id);
    detailsCache.set(id, place);
    return place;
  }

  private async googleAutocomplete(query: string): Promise<PlaceSuggestion[]> {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', query);
    url.searchParams.set('key', googleKey());
    url.searchParams.set('components', 'country:in');
    const body = asRecord(await readJson(url.toString()));
    const status = text(body?.status);
    if (status === 'ZERO_RESULTS') return [];
    if (status !== 'OK') {
      throw new AppError('Google location search failed', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }
    const predictions = Array.isArray(body?.predictions) ? body.predictions : [];
    return predictions
      .map((item) => {
        const row = asRecord(item);
        const placeId = text(row?.place_id);
        const label = text(row?.description);
        if (!placeId || !label) return null;
        return { placeId, label };
      })
      .filter((item): item is PlaceSuggestion => Boolean(item))
      .slice(0, 6);
  }

  private async googleResolve(placeId: string): Promise<ResolvedPlace> {
    if (!googleKey()) {
      throw new AppError(
        'Google location search is not configured',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'formatted_address,geometry,address_components,name');
    url.searchParams.set('key', googleKey());
    const body = asRecord(await readJson(url.toString()));
    if (text(body?.status) !== 'OK') {
      throw new AppError('Place not found', HTTP_STATUS.BAD_REQUEST);
    }
    const result = asRecord(body?.result);
    const geometry = asRecord(result?.geometry);
    const location = asRecord(geometry?.location);
    const latitude = number(location?.lat);
    const longitude = number(location?.lng);
    const address = text(result?.formatted_address) || text(result?.name);
    if (latitude == null || longitude == null || !address) {
      throw new AppError('Place has no coordinates', HTTP_STATUS.BAD_REQUEST);
    }
    const parts = googleParts(result?.address_components);
    return {
      placeId,
      address,
      latitude,
      longitude,
      city: parts.city || '',
      state: parts.state || '',
      area: parts.area || '',
      country: parts.country || 'India',
    };
  }

  private async nominatimAutocomplete(query: string): Promise<PlaceSuggestion[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');
    url.searchParams.set('countrycodes', 'in');
    const body = await readJson(url.toString());
    if (!Array.isArray(body)) return [];
    return body
      .map((item) => {
        const row = asRecord(item);
        const osmType = text(row?.osm_type);
        const osmId = text(row?.osm_id) || String(row?.osm_id ?? '');
        const label = text(row?.display_name);
        if (!osmType || !osmId || !label) return null;
        const place = row ? nominatimPlace(row, `osm:${osmType}:${osmId}`) : null;
        if (place) detailsCache.set(place.placeId, place);
        return { placeId: `osm:${osmType}:${osmId}`, label };
      })
      .filter((item): item is PlaceSuggestion => Boolean(item));
  }

  private async nominatimResolve(placeId: string): Promise<ResolvedPlace> {
    const [, osmType, osmId] = placeId.split(':');
    const prefix = osmType === 'node' ? 'N' : osmType === 'way' ? 'W' : osmType === 'relation' ? 'R' : '';
    if (!prefix || !osmId) {
      throw new AppError('Place not found', HTTP_STATUS.BAD_REQUEST);
    }
    const url = new URL('https://nominatim.openstreetmap.org/lookup');
    url.searchParams.set('osm_ids', `${prefix}${osmId}`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    const body = await readJson(url.toString());
    const row = Array.isArray(body) ? asRecord(body[0]) : null;
    const place = row ? nominatimPlace(row, placeId) : null;
    if (!place) {
      throw new AppError('Place not found', HTTP_STATUS.BAD_REQUEST);
    }
    return place;
  }
}

function googleParts(raw: unknown): AddressParts {
  if (!Array.isArray(raw)) return {};
  const find = (...types: string[]) => {
    for (const item of raw) {
      const row = asRecord(item);
      const rowTypes = Array.isArray(row?.types) ? row.types.map(text) : [];
      if (types.some((type) => rowTypes.includes(type))) {
        return text(row?.long_name);
      }
    }
    return '';
  };
  return {
    city: find('locality', 'administrative_area_level_2', 'postal_town'),
    state: find('administrative_area_level_1'),
    area: find('sublocality_level_1', 'sublocality', 'neighborhood'),
    country: find('country'),
  };
}

function nominatimPlace(row: Record<string, unknown>, placeId: string): ResolvedPlace | null {
  const latitude = number(row.lat);
  const longitude = number(row.lon);
  const address = text(row.display_name);
  if (latitude == null || longitude == null || !address) return null;
  const parts = asRecord(row.address) ?? {};
  return {
    placeId,
    address,
    latitude,
    longitude,
    city: text(parts.city) || text(parts.town) || text(parts.village) || text(parts.state_district),
    state: text(parts.state),
    area: text(parts.suburb) || text(parts.neighbourhood) || text(parts.city_district),
    country: text(parts.country) || 'India',
  };
}

export const placesService = new PlacesService();
