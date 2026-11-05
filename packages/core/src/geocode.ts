/**
 * Place search for the "Add location" box. Goes through the `geocode` edge function (cached, rate limited, identified);
 * if that function is not deployed or fails, it falls back to calling OpenStreetMap directly so the box keeps working.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';

const viaFunction = async (client: any, body: Record<string, unknown>): Promise<any | null> => {
  try {
    const { data, error } = await client.functions.invoke('geocode', { body });
    if (error || data == null || (typeof data === 'object' && !Array.isArray(data) && (data as any).error)) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return null;
  }
};

export const geocodeSearch = async (client: any, q: string): Promise<any[]> => {
  const text = q.replace(/\s+/g, ' ').trim();
  if (text.length < 2) return [];
  const viaFn = await viaFunction(client, { q: text });
  if (Array.isArray(viaFn)) return viaFn;
  try {
    const res = await fetch(`${NOMINATIM}/search?format=json&q=${encodeURIComponent(text)}&limit=6&addressdetails=1`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const geocodeReverse = async (client: any, lat: number, lon: number): Promise<any | null> => {
  const viaFn = await viaFunction(client, { lat, lon });
  if (viaFn && !Array.isArray(viaFn)) return viaFn;
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
    return await res.json();
  } catch {
    return null;
  }
};
