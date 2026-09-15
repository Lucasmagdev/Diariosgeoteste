/** Returns a safe, openable href for a pasted Google Maps link (prepends https:// if missing). */
export function normalizeMapsUrl(raw?: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

/**
 * Tries to extract lat/lng from a Google Maps link or raw coordinates.
 * Works for full links (`@-19.9,-43.9`, `?q=lat,lng`, `!3dLAT!4dLNG`, `ll=`).
 * Short links (maps.app.goo.gl) carry no coordinates and return undefined.
 */
export function extractCoordsFromMapsUrl(raw?: string): { lat: number; lng: number } | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  const valid = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0);

  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // /maps/place/...@lat,lng,17z
    /[?&](?:q|ll|center)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=lat,lng
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // !3dLAT!4dLNG
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // bare "lat,lng"
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return undefined;
}

/**
 * Geocodes a free-text address into coordinates using OpenStreetMap Nominatim
 * (free, no API key). Returns undefined when nothing is found.
 * Usage policy: low volume, one request at a time.
 */
export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lng: number } | undefined> {
  const raw = query.trim();
  if (!raw) return undefined;

  // Drop CEP (often not in OSM and skews results), normalize separators.
  const cleaned = raw
    .replace(/\b\d{5}-?\d{3}\b/g, "")
    .replace(/[;\n]/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Brazilian street addresses frequently miss in OSM; progressively drop the
  // leftmost segment (street → neighborhood → city) until something matches.
  let segments = cleaned
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const attempts: string[] = [];
  while (segments.length) {
    const candidate = segments.join(", ");
    if (!attempts.includes(candidate)) attempts.push(candidate);
    segments = segments.slice(1);
  }

  for (const attempt of attempts) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(
      attempt,
    )}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Falha ao buscar endereço");
    const data = (await response.json()) as Array<{ lat: string; lon: string }>;
    if (Array.isArray(data) && data.length > 0) {
      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return undefined;
}

/** Loose check that a string looks like a Google Maps / coordinates link. */
export function isLikelyMapsUrl(raw?: string): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("google.") ||
    value.includes("maps.app.goo.gl") ||
    value.includes("goo.gl/maps") ||
    value.includes("maps.google") ||
    /-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/.test(value) // bare lat,lng
  );
}


