const API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
const BASE_URL = 'https://api.giphy.com/v1';

export interface GiphyItem {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

interface GiphyApiImage {
  url: string;
  width: string;
  height: string;
}

interface GiphyApiItem {
  id: string;
  images: {
    original: GiphyApiImage;
    fixed_width: GiphyApiImage;
    fixed_width_small?: GiphyApiImage;
  };
}

function mapItem(item: GiphyApiItem): GiphyItem {
  const preview = item.images.fixed_width_small ?? item.images.fixed_width;
  return {
    id: item.id,
    url: item.images.original.url,
    previewUrl: preview.url,
    width: Number(item.images.original.width),
    height: Number(item.images.original.height),
  };
}

async function request(path: string, params: Record<string, string>): Promise<GiphyItem[]> {
  if (!API_KEY) {
    console.warn('Missing EXPO_PUBLIC_GIPHY_API_KEY — GIF/sticker picker will stay empty.');
    return [];
  }
  const query = new URLSearchParams({ api_key: API_KEY, limit: '30', rating: 'pg-13', ...params });
  const response = await fetch(`${BASE_URL}${path}?${query.toString()}`);
  if (!response.ok) throw new Error(`Giphy request failed: ${response.status}`);
  const json = await response.json();
  return ((json.data as GiphyApiItem[]) ?? []).map(mapItem);
}

export function searchGifs(query: string) {
  return request('/gifs/search', { q: query });
}

export function trendingGifs() {
  return request('/gifs/trending', {});
}

export function searchStickers(query: string) {
  return request('/stickers/search', { q: query });
}

export function trendingStickers() {
  return request('/stickers/trending', {});
}
