export const TMDB_API_KEY = (import.meta.env.VITE_TMDB_API_KEY || '').replace(/^VITE_TMDB_API_KEY=/, '').trim();
export const TMDB_BASE_URL = 'https://api.tmdb.org/3'; // Using api.tmdb.org to bypass common Jio/Airtel blocks
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

/**
 * Proxy Bridge for ISP-blocked networks (Jio/Airtel) 
 * We use a public CORS proxy as a fallback if the direct connection is throttled or blocked.
 */
const HELPERS = {
    CORS_PROXIES: [
        '', // Direct connection
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ]
};

/**
 * Image Proxy Bridge for ISP-blocked poster assets (Jio/Airtel) 
 * We use weserv.nl as it handles large volumes and bypasses most ISP-level image blocks.
 */
export const getSafeImageUrl = (path: string | null): string | null => {
    if (!path) return null;
    const isFullUrl = path.startsWith('http');
    const originalUrl = isFullUrl ? path : `${TMDB_IMAGE_BASE_URL}${path}`;
    // Stealth fallback: Wrap in weserv.nl to bypass mobile ISP blocks (South Asia)
    return `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}&w=342&q=80`;
};

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
}

// ---------------------------------------------------------------------------
// LocalStorage Cache — data persists so users NEVER see blank on slow networks
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'tmdb_v3';
const CACHE_TTL = 1000 * 60 * 60 * 12; // Increased to 12 hours for mobile resilience

const getCached = (key: string): TMDBContent[] | null => {
    try {
        const raw = localStorage.getItem(`${CACHE_VERSION}_${key}`);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) {
            localStorage.removeItem(`${CACHE_VERSION}_${key}`);
            return null;
        }
        return data;
    } catch {
        return null;
    }
};

const setCache = (key: string, data: TMDBContent[]) => {
    try {
        localStorage.setItem(`${CACHE_VERSION}_${key}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {
        // Storage full — silently ignore
    }
};

// ---------------------------------------------------------------------------
// Fetch with ISP-Safe Bridge — survivors Jio/Airtel DNS blocks
// ---------------------------------------------------------------------------
const fetchWithRetry = async (url: string, retries = 2, baseDelay = 1000): Promise<any> => {
    const urlsToTry = [
        url,
        url.replace('api.tmdb.org', 'api.themoviedb.org')
    ];

    const entryPoints: string[] = [];
    
    // Direct connections first
    urlsToTry.forEach(u => entryPoints.push(u));
    HELPERS.CORS_PROXIES.forEach(proxy => {
        if (proxy) {
            urlsToTry.forEach(u => entryPoints.push(`${proxy}${encodeURIComponent(u)}`));
        }
    });

    for (let proxyIdx = 0; proxyIdx < entryPoints.length; proxyIdx++) {
        const finalUrl = entryPoints[proxyIdx];
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            // Give direct connection at least 25s before timing out, because TMDB takes 11-18s on this ISP
            const timeout = proxyIdx === 0 || proxyIdx === 1 ? 25000 : 15000 + attempt * 5000;
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(finalUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    if (response.status >= 500 && attempt < retries) {
                        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
                        continue;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                // Extremely important: check if API returned an error object
                if (data.success === false || data.status_code) {
                    throw new Error(data.status_message || 'TMDB API Error');
                }

                // If a proxy returns 200 OK but the JSON is an error message missing the 'results' array
                if (!data.results && !data.id && !data.cast && !data.parts) {
                    throw new Error(`Invalid TMDB response (Missing results). Body: ${JSON.stringify(data).substring(0, 100)}`);
                }

                return data; // Return the parsed JSON data, NOT the response!
            } catch (error: any) {
                clearTimeout(timeoutId);
                
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
                    continue;
                }
            }
        }
    }

    throw new Error('All entry points for TMDB are unreachable on this network.');
};

// ---------------------------------------------------------------------------
// Local Content Filter
// ---------------------------------------------------------------------------
const BLACKLIST_KEYWORDS = [
    'ullu', 'charmsukh', 'palang tod', 'kullu', 'hotshots', 
    'erotic', 'kooku', 'rabbit movies', 'primeplay', 'voovi', 'besharam'
];

// Use word boundaries (\b) so we don't accidentally match substrings 
// e.g. "pull us" -> contains "ullu" but won't match \bullu\b
const BLACKLIST_REGEX = new RegExp(`\\b(${BLACKLIST_KEYWORDS.join('|')})\\b`, 'i');

const filterSafeContent = (results: TMDBContent[]) => {
    return results.filter(item => {
        const text = `${item.title || ''} ${item.name || ''} ${item.overview || ''}`;
        return !BLACKLIST_REGEX.test(text);
    });
};

// ---------------------------------------------------------------------------
// Core fetch — uses cache-first then network to guarantee data shows up
// ---------------------------------------------------------------------------
export const fetchByPath = async (path: string, params: string = '', forceNetwork = false): Promise<TMDBContent[]> => {
    const cacheKey = `${path}${params}`;
    const cached = getCached(cacheKey);

    // CRITICAL: Return valid cached data instantly to prevent massive sequential loading delays
    if (cached && cached.length > 0 && !forceNetwork) {
        return filterSafeContent(cached);
    }

    try {
        const url = `${TMDB_BASE_URL}${path}?api_key=${TMDB_API_KEY}&language=en-US${params}`;
        
        // rawData is now the parsed JSON object directly from fetchWithRetry
        const rawData = await fetchWithRetry(url);
        
        let data = rawData;
        
        // Some proxies return the TMDB response wrapped in a 'contents' field
        if (rawData && rawData.contents) {
            try {
                data = typeof rawData.contents === 'string' ? JSON.parse(rawData.contents) : rawData.contents;
            } catch (e) {
                // Ignore parse errors, fallback to rawData
            }
        }
            
        const results = filterSafeContent(data.results || []);
        
        if (results.length > 0) {
            setCache(cacheKey, results);
        }
        return results;
    } catch (error) {
        console.warn(`TMDB fetch failed for ${path}, using cache:`, error);
        if (cached && cached.length > 0) {
            return filterSafeContent(cached);
        }
        throw error;
    }
};

export const fetchContent = async (type: 'movie' | 'tv' | 'short', language?: string): Promise<TMDBContent[]> => {
    const langParam = language && language !== 'all' ? `&with_original_language=${language}` : '';

    if (type === 'tv') {
        return fetchByPath('/discover/tv', `&sort_by=popularity.desc&include_adult=false&include_null_first_air_dates=false&page=1${langParam}`);
    } else if (type === 'short') {
        return fetchByPath('/discover/movie', `&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&with_runtime.lte=40${langParam}`);
    } else {
        if (language && language !== 'all') {
            return fetchByPath('/discover/movie', `&sort_by=popularity.desc&include_adult=false&include_video=false&page=1${langParam}`);
        } else {
            return fetchByPath('/movie/now_playing', `&page=1&region=IN`);
        }
    }
};

export const fetchTrending = (type: 'movie' | 'tv' = 'movie', page = 1) => fetchByPath(`/trending/${type}/week`, `&page=${page}`);
export const fetchTopRated = (type: 'movie' | 'tv' = 'movie', page = 1) => fetchByPath(`/${type}/top_rated`, `&page=${page}`);
export const fetchUpcoming = (page = 1) => fetchByPath('/movie/upcoming', `&page=${page}&region=IN`);
export const fetchNowPlaying = (page = 1) => fetchByPath('/movie/now_playing', `&page=${page}&region=IN`);
export const fetchUpcomingTv = (page = 1) => fetchByPath('/tv/on_the_air', `&page=${page}`);
export const fetchActionMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=28&sort_by=popularity.desc&page=${page}`);
export const fetchComedyMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=35&sort_by=popularity.desc&page=${page}`);
export const fetchIndianMovies = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchIndianAction = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&with_genres=28&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchIndianComedy = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&with_genres=35,18&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchIndianHorror = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&with_genres=27,53&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchIndianTv = (page = 1) => fetchByPath('/discover/tv', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchTeluguMovies = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=te&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchHindiMovies = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=hi&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchTamilMovies = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=ta&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchMalayalamMovies = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=ml&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchKannadaMovies = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=kn&sort_by=popularity.desc&region=IN&page=${page}`);
export const fetchHorrorMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=27&sort_by=popularity.desc&page=${page}`);
export const fetchSciFiMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=878&sort_by=popularity.desc&page=${page}`);
export const fetchRomanceMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=10749&sort_by=popularity.desc&page=${page}`);
export const fetchTvSeries = (genreId?: number, page = 1) => fetchByPath('/discover/tv', `&sort_by=popularity.desc&page=${page}${genreId ? `&with_genres=${genreId}` : ''}`);
export const fetchMoviesByGenre = (genreId: number, page = 1) => fetchByPath('/discover/movie', `&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`);
export const fetchAnime = (page = 1) => fetchByPath('/discover/tv', `&with_genres=16&sort_by=popularity.desc&page=${page}`);
export const fetchDocumentaries = (page = 1) => fetchByPath('/discover/movie', `&with_genres=99&sort_by=popularity.desc&page=${page}`);
export const fetchMystery = (page = 1) => fetchByPath('/discover/movie', `&with_genres=9648&sort_by=popularity.desc&page=${page}`);
export const fetchSciFiFantasy = (page = 1) => fetchByPath('/discover/movie', `&with_genres=878,14&sort_by=popularity.desc&page=${page}`);
export const fetchFamilyMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=10751&sort_by=popularity.desc&page=${page}`);
export const fetchAnimation = (page = 1) => fetchByPath('/discover/movie', `&with_genres=16&sort_by=popularity.desc&page=${page}`);
export const fetchAdventure = (page = 1) => fetchByPath('/discover/movie', `&with_genres=12&sort_by=popularity.desc&page=${page}`);
export const fetchCrimeMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=80&sort_by=popularity.desc&page=${page}`);
export const fetchWarMovies = (page = 1) => fetchByPath('/discover/movie', `&with_genres=10752&sort_by=popularity.desc&page=${page}`);
export const fetchMusicals = (page = 1) => fetchByPath('/discover/movie', `&with_genres=10402&sort_by=popularity.desc&page=${page}`);
export const fetchIndianFamily = (page = 1) => fetchByPath('/discover/movie', `&with_original_language=hi%7Cte%7Cta%7Cml%7Ckn&with_genres=10751&sort_by=popularity.desc&page=${page}`);
export const searchContent = (query: string, page = 1) => fetchByPath('/search/multi', `&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`);

// Fetch detailed information for a specific movie or TV show
export const fetchContentDetails = async (id: number, type: 'movie' | 'tv' = 'movie') => {
    try {
        const endpoint = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
        const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,similar,reviews`;
        const data = await fetchWithRetry(url);
        
        // Handle proxy wrapping
        if (data && data.contents) {
            return typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
        }
        
        return data;
    } catch (error) {
        console.error(`Error fetching ${type} details:`, error);
        return null;
    }
};

// Alias for backward compatibility
export const fetchLatestRatings = () => fetchContent('movie');
export const fetchMovies = (language?: string) => fetchContent('movie', language);
