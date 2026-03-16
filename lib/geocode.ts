import { CONFIG } from "./config";

export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const url = new URL(CONFIG.geocode.baseUrl);
  url.searchParams.set("q", address);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`住所が見つかりませんでした: ${address}`);
  }

  const [lon, lat] = data[0].geometry.coordinates;
  return {
    address: data[0].properties.title || address,
    latitude: lat,
    longitude: lon,
  };
}
