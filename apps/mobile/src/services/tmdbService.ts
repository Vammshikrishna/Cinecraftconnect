import { ENV } from '../config/env';

export interface TMDBContent {
  id: number;
  title?: string;
  name?: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  original_language: string;
  genre_ids?: number[];
  user_rating?: number | null;
  app_rating?: number | null;
}

const TMDB_BASE_URL = 'https://api.tmdb.org/3';
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes memory cache

export const getSafeImageUrl = (path: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
};

export const getThumbnailImageUrl = (path: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
};

export const fetchFromTMDB = async (path: string, params: string = ''): Promise<any> => {
  const cacheKey = `${path}?${params}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const apiKey = ENV.TMDB_API_KEY;
    if (!apiKey) {
      return null;
    }
    const url = `${TMDB_BASE_URL}${path}?api_key=${apiKey}&language=en-US${params}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`TMDB error: ${response.status}`);
    }
    const data = await response.json();
    memoryCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.warn(`[TMDB] Fetch error for ${path}:`, error);
    return null;
  }
};

export const searchContent = async (query: string, page: number = 1): Promise<TMDBContent[]> => {
  if (!query.trim()) return [];
  const data = await fetchFromTMDB('/search/multi', `&query=${encodeURIComponent(query)}&include_adult=false&page=${page}`);
  return data?.results || [];
};

export const fetchTrending = async (type: 'movie' | 'tv' = 'movie', page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB(`/trending/${type}/week`, `&page=${page}`);
  return data?.results || [];
};

export const fetchTopRated = async (type: 'movie' | 'tv' = 'movie', page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB(`/${type}/top_rated`, `&page=${page}`);
  return data?.results || [];
};

export const fetchUpcoming = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/movie/upcoming', `&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchNowPlaying = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/movie/now_playing', `&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchIndianMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&sort_by=popularity.desc&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchTeluguMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_original_language=te&sort_by=popularity.desc&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchHindiMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_original_language=hi&sort_by=popularity.desc&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchTamilMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_original_language=ta&sort_by=popularity.desc&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchMalayalamMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_original_language=ml&sort_by=popularity.desc&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchKannadaMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_original_language=kn&sort_by=popularity.desc&region=IN&page=${page}`);
  return data?.results || [];
};

export const fetchActionMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=28&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchComedyMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=35&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchHorrorMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=27&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchSciFiMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=878&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchTvSeries = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/tv', `&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchAnime = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/tv', `&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchRomanceMovies = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=10749&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchMystery = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=9648&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchDocumentaries = async (page: number = 1): Promise<TMDBContent[]> => {
  const data = await fetchFromTMDB('/discover/movie', `&with_genres=99&sort_by=popularity.desc&page=${page}`);
  return data?.results || [];
};

export const fetchContentDetails = async (id: number, type: 'movie' | 'tv' = 'movie'): Promise<any> => {
  const data = await fetchFromTMDB(type === 'movie' ? `/movie/${id}` : `/tv/${id}`, '&append_to_response=credits,videos,similar,reviews');
  return data;
};
