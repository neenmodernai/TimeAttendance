// src/lib/geo.ts
export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, p = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * p) / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(((bLng - aLng) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export type Site = { id: string; name: string; lat: number; lng: number; radius_m: number };
export function nearestSite(lat: number, lng: number, sites: Site[]) {
  let best: { site: Site; dist: number } | null = null;
  for (const s of sites) {
    const dist = haversineM(lat, lng, s.lat, s.lng);
    if (!best || dist < best.dist) best = { site: s, dist };
  }
  return best;
}
