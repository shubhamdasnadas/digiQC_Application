// LocationIQ API Integration
const BASE = "https://us1.locationiq.com/v1"; // use eu1 if most users are in Europe

export interface LocationIQPlace {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

// 1. Forward geocoding: address -> lat/lng (from the LocationIQ documentation)
export async function searchAddress(token: string, query: string, limit = 5): Promise<LocationIQPlace[]> {
  if (!token || !query.trim()) return [];
  const url = `${BASE}/search?key=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}&format=json&limit=${limit}`;
  const res = await fetch(url);
  if (res.status === 404) return []; // no results
  if (!res.ok) throw new Error(`LocationIQ search failed: ${res.status}`);
  const data = await res.json();
  return data.map((p: any) => ({
    placeId: p.place_id,
    address: p.display_name,
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lon),
  }));
}

// 2. Autocomplete: for suggestions while typing
export async function autocompleteAddress(
  token: string,
  query: string,
  limit = 5,
  signal?: AbortSignal
): Promise<LocationIQPlace[]> {
  if (!token || !query.trim()) return [];
  const url = `${BASE}/autocomplete?key=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}&limit=${limit}&format=json`;
  const res = await fetch(url, { signal });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`LocationIQ autocomplete failed: ${res.status}`);
  const data = await res.json();
  return data.map((p: any) => ({
    placeId: p.place_id,
    address: p.display_name,
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lon),
  }));
}

// 3. Reverse geocoding: lat/lng -> address
export async function reverseGeocode(token: string, lat: number, lng: number): Promise<{ address: string; lat: number; lng: number } | null> {
  if (!token) return null;
  const url = `${BASE}/reverse?key=${encodeURIComponent(token)}&lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`LocationIQ reverse failed: ${res.status}`);
  const data = await res.json();
  return { address: data.display_name, lat: parseFloat(data.lat), lng: parseFloat(data.lon) };
}

// 4. Timezone resolution from coordinates
export function getTimezoneFromCoordinates(lat: number, lng: number): string {
  // India (default for Mumbai / subcontinent)
  if (lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) return 'Asia/Calcutta';
  // UAE / Middle East
  if (lat >= 22 && lat <= 27 && lng >= 51 && lng <= 57) return 'Asia/Dubai';
  // Singapore / Malaysia
  if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 105) return 'Asia/Singapore';
  // Japan
  if (lat >= 30 && lat <= 46 && lng >= 128 && lng <= 146) return 'Asia/Tokyo';
  // China
  if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) return 'Asia/Shanghai';
  // UK
  if (lat >= 49 && lat <= 61 && lng >= -11 && lng <= 2) return 'Europe/London';
  // France / Western Europe
  if (lat >= 42 && lat <= 51 && lng >= -5 && lng <= 9) return 'Europe/Paris';
  // Germany / Central Europe
  if (lat >= 47 && lat <= 55 && lng >= 5 && lng <= 16) return 'Europe/Berlin';
  // US East
  if (lat >= 24 && lat <= 50 && lng >= -85 && lng <= -65) return 'America/New_York';
  // US Central
  if (lat >= 25 && lat <= 50 && lng >= -105 && lng < -85) return 'America/Chicago';
  // US West
  if (lat >= 30 && lat <= 50 && lng >= -125 && lng <= -105) return 'America/Los_Angeles';
  // Australia
  if (lat >= -44 && lat <= -10 && lng >= 110 && lng <= 155) return 'Australia/Sydney';
  // South Africa
  if (lat >= -35 && lat <= -22 && lng >= 16 && lng <= 33) return 'Africa/Johannesburg';

  // Longitude-based timezone approximation
  const offsetHours = Math.round(lng / 15);
  if (offsetHours >= 5 && offsetHours <= 6) return 'Asia/Calcutta';
  if (offsetHours === 4) return 'Asia/Dubai';
  if (offsetHours === 8) return 'Asia/Singapore';
  if (offsetHours === 9) return 'Asia/Tokyo';
  if (offsetHours === 0) return 'Europe/London';
  if (offsetHours === 1) return 'Europe/Paris';
  if (offsetHours === -5) return 'America/New_York';
  if (offsetHours === -6) return 'America/Chicago';
  if (offsetHours === -8) return 'America/Los_Angeles';
  if (offsetHours === 10) return 'Australia/Sydney';

  return 'Asia/Calcutta';
}
