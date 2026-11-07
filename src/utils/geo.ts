/** Great-circle distance in kilometres. */
export function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const km = 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(a)));
  if (!Number.isFinite(km)) return 0;
  if (km < 0.1) return 0.1;
  return Math.round(km * 10) / 10;
}

/** Default candidate / discovery origin — Connaught Place area, Delhi. */
export const DELHI_ORIGIN = {
  city: 'Delhi',
  state: 'Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
} as const;

export function resolveSearchOrigin(input?: {
  lat?: number;
  lng?: number;
}): { latitude: number; longitude: number; isDefault: boolean } {
  if (
    typeof input?.lat === 'number' &&
    Number.isFinite(input.lat) &&
    typeof input?.lng === 'number' &&
    Number.isFinite(input.lng)
  ) {
    return { latitude: input.lat, longitude: input.lng, isDefault: false };
  }
  return {
    latitude: DELHI_ORIGIN.latitude,
    longitude: DELHI_ORIGIN.longitude,
    isDefault: true,
  };
}
