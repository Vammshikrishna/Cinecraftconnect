export const TMDB_API_KEY = '6f333da40e57ee8319f5f977a458ef98'; // Replace with your actual API key
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342'; // Optimized from w500 for faster 4G loading

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

export const fetchByPath = async (path: string, params: string = ''): Promise<TMDBContent[]> => {
    try {
        const url = `${TMDB_BASE_URL}${path}?api_key=${TMDB_API_KEY}&language=en-US${params}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${path}`);
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        return [];
    }
};

export const fetchContent = async (type: 'movie' | 'tv' | 'short', language?: string): Promise<TMDBContent[]> => {
    // Re-implement using fetchByPath or keep custom logic for specific filters
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

export const fetchTrending = (type: 'movie' | 'tv' = 'movie') => fetchByPath(`/trending/${type}/week`);
export const fetchTopRated = (type: 'movie' | 'tv' = 'movie') => fetchByPath(`/${type}/top_rated`, '&page=1');
export const fetchUpcoming = () => fetchByPath('/movie/upcoming', '&page=1&region=IN');
export const fetchNowPlaying = () => fetchByPath('/movie/now_playing', '&page=1&region=IN');
export const fetchUpcomingTv = () => fetchByPath('/tv/on_the_air', '&page=1');
export const fetchActionMovies = () => fetchByPath('/discover/movie', '&with_genres=28&sort_by=popularity.desc');
export const fetchComedyMovies = () => fetchByPath('/discover/movie', '&with_genres=35&sort_by=popularity.desc');
export const fetchIndianMovies = () => fetchByPath('/discover/movie', '&with_original_language=hi|te|ta|ml|kn&sort_by=popularity.desc&region=IN');
export const fetchIndianAction = () => fetchByPath('/discover/movie', '&with_original_language=hi|te|ta|ml|kn&with_genres=28&sort_by=popularity.desc&region=IN');
export const fetchIndianComedy = () => fetchByPath('/discover/movie', '&with_original_language=hi|te|ta|ml|kn&with_genres=35,18&sort_by=popularity.desc&region=IN');
export const fetchIndianHorror = () => fetchByPath('/discover/movie', '&with_original_language=hi|te|ta|ml|kn&with_genres=27,53&sort_by=popularity.desc&region=IN');
export const fetchIndianTv = () => fetchByPath('/discover/tv', '&with_original_language=hi|te|ta|ml|kn&sort_by=popularity.desc&region=IN');
export const fetchTeluguMovies = () => fetchByPath('/discover/movie', '&with_original_language=te&sort_by=popularity.desc&region=IN');
export const fetchHindiMovies = () => fetchByPath('/discover/movie', '&with_original_language=hi&sort_by=popularity.desc&region=IN');
export const fetchTamilMovies = () => fetchByPath('/discover/movie', '&with_original_language=ta&sort_by=popularity.desc&region=IN');
export const fetchMalayalamMovies = () => fetchByPath('/discover/movie', '&with_original_language=ml&sort_by=popularity.desc&region=IN');
export const fetchKannadaMovies = () => fetchByPath('/discover/movie', '&with_original_language=kn&sort_by=popularity.desc&region=IN');
export const fetchHorrorMovies = () => fetchByPath('/discover/movie', '&with_genres=27&sort_by=popularity.desc');
export const fetchSciFiMovies = () => fetchByPath('/discover/movie', '&with_genres=878&sort_by=popularity.desc');
export const fetchRomanceMovies = () => fetchByPath('/discover/movie', '&with_genres=10749&sort_by=popularity.desc');
export const fetchTvSeries = (genreId?: number) => fetchByPath('/discover/tv', `&sort_by=popularity.desc&page=1${genreId ? `&with_genres=${genreId}` : ''}`);
export const fetchMoviesByGenre = (genreId: number) => fetchByPath('/discover/movie', `&with_genres=${genreId}&sort_by=popularity.desc&page=1`);
export const fetchAnime = () => fetchByPath('/discover/tv', '&with_genres=16&sort_by=popularity.desc');
export const fetchDocumentaries = () => fetchByPath('/discover/movie', '&with_genres=99&sort_by=popularity.desc');
export const fetchMystery = () => fetchByPath('/discover/movie', '&with_genres=9648&sort_by=popularity.desc');
export const fetchSciFiFantasy = () => fetchByPath('/discover/movie', '&with_genres=878,14&sort_by=popularity.desc');
export const fetchFamilyMovies = () => fetchByPath('/discover/movie', '&with_genres=10751&sort_by=popularity.desc');
export const fetchAnimation = () => fetchByPath('/discover/movie', '&with_genres=16&sort_by=popularity.desc');
export const fetchAdventure = () => fetchByPath('/discover/movie', '&with_genres=12&sort_by=popularity.desc');
export const fetchCrimeMovies = () => fetchByPath('/discover/movie', '&with_genres=80&sort_by=popularity.desc');
export const fetchWarMovies = () => fetchByPath('/discover/movie', '&with_genres=10752&sort_by=popularity.desc');
export const fetchMusicals = () => fetchByPath('/discover/movie', '&with_genres=10402&sort_by=popularity.desc');
export const fetchIndianFamily = () => fetchByPath('/discover/movie', '&with_original_language=hi|te|ta|ml|kn&with_genres=10751&sort_by=popularity.desc');
export const searchContent = (query: string) => fetchByPath('/search/multi', `&query=${encodeURIComponent(query)}&page=1&include_adult=false`);

// Fetch detailed information for a specific movie or TV show
export const fetchContentDetails = async (id: number, type: 'movie' | 'tv' = 'movie') => {
    try {
        const endpoint = type === 'movie' ? `/movie/${id}` : `/tv/${id}`;
        const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=credits,videos,similar,reviews`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${type} details`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${type} details:`, error);
        return null;
    }
};

// Alias for backward compatibility
export const fetchLatestRatings = () => fetchContent('movie');
export const fetchMovies = (language?: string) => fetchContent('movie', language);
