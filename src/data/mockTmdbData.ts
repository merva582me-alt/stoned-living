import { MediaItem, ActorDetail, CollectionDetail, Genre, WeedStrainMatch } from '../types';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const GENRES_LIST: Genre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' }
];

export const MOCK_MOVIES: MediaItem[] = [
  {
    id: 11130,
    title: 'Pineapple Express',
    original_title: 'Pineapple Express',
    overview: 'A process server and his marijuana dealer find themselves on the run from the mob and a corrupt cop after witnessing his dealer\'s boss murder a competitor.',
    poster_path: '/4U5T7hInG8s078W8N3eYxS1gK3e.jpg',
    backdrop_path: '/42b3m9sH5n7d3jK4n8S8N0x5P3.jpg',
    release_date: '2008-08-06',
    vote_average: 7.9,
    vote_count: 4210,
    popularity: 98.4,
    genre_ids: [35, 28, 80],
    genres: [{ id: 35, name: 'Comedy' }, { id: 28, name: 'Action' }, { id: 80, name: 'Crime' }],
    media_type: 'movie',
    runtime: 112,
    tagline: 'Put this in your pipe and smoke it.',
    status: 'Released',
    imdb_id: 'tt0910970',
    budget: 27000000,
    revenue: 102400000,
    couchlock_score: 99,
    chill_vibe: 'Hilarious Comedy',
    strain_pairing: 'Pineapple Express (Sativa-Dominant Hybrid)',
    cast: [
      { id: 19274, name: 'Seth Rogen', character: 'Dale Denton', profile_path: '/i25608hS9x9k9n9s9e.jpg' },
      { id: 17051, name: 'James Franco', character: 'Saul Silver', profile_path: '/x25608hS9x9k9n9s9e.jpg' },
      { id: 3290, name: 'Danny McBride', character: 'Red', profile_path: '/y25608hS9x9k9n9s9e.jpg' },
      { id: 81313, name: 'Amber Heard', character: 'Angie Anderson', profile_path: '/z25608hS9x9k9n9s9e.jpg' }
    ]
  },
  {
    id: 157336,
    title: 'Interstellar',
    original_title: 'Interstellar',
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop_path: '/xJHokMbljvjADYdit5fK1R3O234.jpg',
    release_date: '2014-11-05',
    vote_average: 8.8,
    vote_count: 34120,
    popularity: 142.8,
    genre_ids: [878, 18, 12],
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 18, name: 'Drama' }, { id: 12, name: 'Adventure' }],
    media_type: 'movie',
    runtime: 169,
    tagline: 'Mankind was born on Earth. It was never meant to die here.',
    status: 'Released',
    imdb_id: 'tt0816692',
    budget: 165000000,
    revenue: 701700000,
    couchlock_score: 95,
    chill_vibe: 'Deep Mindbend',
    strain_pairing: 'Granddaddy Purple (Indica)',
    cast: [
      { id: 10296, name: 'Matthew McConaughey', character: 'Cooper', profile_path: '/s49d8923.jpg' },
      { id: 1813, name: 'Anne Hathaway', character: 'Brand', profile_path: '/d3923892.jpg' },
      { id: 3895, name: 'Jessica Chastain', character: 'Murph', profile_path: '/f3292839.jpg' },
      { id: 3894, name: 'Michael Caine', character: 'Professor Brand', profile_path: '/a3292839.jpg' }
    ]
  },
  {
    id: 115,
    title: 'The Big Lebowski',
    original_title: 'The Big Lebowski',
    overview: 'Jeffrey "The Dude" Lebowski, a Los Angeles slacker who only wants to bowl and drink White Russians, is mistaken for a millionaire with the same name whose wife has been kidnapped.',
    poster_path: '/99e2Y6N85a7XkP4J5E3e0b8a.jpg',
    backdrop_path: '/4b7123jK5n7d3jK4n8S8N0x5P3.jpg',
    release_date: '1998-03-06',
    vote_average: 8.3,
    vote_count: 11200,
    popularity: 85.2,
    genre_ids: [35, 80],
    genres: [{ id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }],
    media_type: 'movie',
    runtime: 117,
    tagline: 'Her life was in their hands. Now her toe is in the mail.',
    status: 'Released',
    imdb_id: 'tt0118715',
    budget: 15000000,
    revenue: 46700000,
    couchlock_score: 100,
    chill_vibe: 'Cozy Nostalgia',
    strain_pairing: 'Northern Lights (Indica)',
    cast: [
      { id: 1229, name: 'Jeff Bridges', character: 'The Dude', profile_path: '/dude.jpg' },
      { id: 1230, name: 'John Goodman', character: 'Walter Sobchak', profile_path: '/walter.jpg' },
      { id: 1231, name: 'Julianne Moore', character: 'Maude Lebowski', profile_path: '/maude.jpg' },
      { id: 1232, name: 'Steve Buscemi', character: 'Donny', profile_path: '/donny.jpg' }
    ]
  },
  {
    id: 545611,
    title: 'Everything Everywhere All at Once',
    original_title: 'Everything Everywhere All at Once',
    overview: 'An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world by exploring other universes connecting with the lives she could have led.',
    poster_path: '/r2J02Z2OpNTctAOS31Y2A3sR2.jpg',
    backdrop_path: '/space_multiverse.jpg',
    release_date: '2022-03-24',
    vote_average: 8.7,
    vote_count: 12800,
    popularity: 135.6,
    genre_ids: [28, 12, 35, 878],
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 35, name: 'Comedy' }, { id: 28, name: 'Action' }],
    media_type: 'movie',
    runtime: 139,
    tagline: 'The universe is a place where anything can happen.',
    status: 'Released',
    imdb_id: 'tt6710474',
    couchlock_score: 96,
    chill_vibe: 'Visually Trippy',
    strain_pairing: 'Blue Dream (Hybrid)',
    cast: [
      { id: 1620, name: 'Michelle Yeoh', character: 'Evelyn Wang', profile_path: '/yeoh.jpg' },
      { id: 1621, name: 'Ke Huy Quan', character: 'Waymond Wang', profile_path: '/quan.jpg' },
      { id: 1622, name: 'Stephanie Hsu', character: 'Joy Wang / Jobu Tupaki', profile_path: '/hsu.jpg' },
      { id: 1623, name: 'Jamie Lee Curtis', character: 'Deirdre Beaubeirdre', profile_path: '/curtis.jpg' }
    ]
  },
  {
    id: 693134,
    title: 'Dune: Part Two',
    original_title: 'Dune: Part Two',
    overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.',
    poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    backdrop_path: '/xOMo8BRK7PfcJv93R93R93.jpg',
    release_date: '2024-02-27',
    vote_average: 8.6,
    vote_count: 8900,
    popularity: 180.5,
    genre_ids: [878, 12, 18],
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 12, name: 'Adventure' }],
    media_type: 'movie',
    runtime: 166,
    tagline: 'Long live the fighters.',
    status: 'Released',
    couchlock_score: 94,
    chill_vibe: 'Cosmic Sci-Fi',
    strain_pairing: 'Durban Poison (Sativa)',
    cast: [
      { id: 1190668, name: 'Timothée Chalamet', character: 'Paul Atreides', profile_path: '/chalamet.jpg' },
      { id: 505710, name: 'Zendaya', character: 'Chani', profile_path: '/zendaya.jpg' },
      { id: 93210, name: 'Rebecca Ferguson', character: 'Lady Jessica', profile_path: '/ferguson.jpg' }
    ]
  },
  {
    id: 27205,
    title: 'Inception',
    original_title: 'Inception',
    overview: 'Cobb, a skilled thief who steals valuable secrets from deep within the subconscious during the dream state, is offered a chance at redemption.',
    poster_path: '/oYu2T135M1S332u2Ue3u2a2a.jpg',
    backdrop_path: '/s39239823.jpg',
    release_date: '2010-07-15',
    vote_average: 8.4,
    vote_count: 36000,
    popularity: 110.2,
    genre_ids: [878, 28, 12],
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 28, name: 'Action' }],
    media_type: 'movie',
    runtime: 148,
    couchlock_score: 97,
    chill_vibe: 'Deep Mindbend',
    strain_pairing: 'Gelato #33 (Hybrid)',
    cast: [
      { id: 6193, name: 'Leonardo DiCaprio', character: 'Dom Cobb', profile_path: '/leo.jpg' },
      { id: 24045, name: 'Joseph Gordon-Levitt', character: 'Arthur', profile_path: '/jgl.jpg' },
      { id: 27578, name: 'Elliot Page', character: 'Ariadne', profile_path: '/page.jpg' }
    ]
  }
];

export const MOCK_SHOWS: MediaItem[] = [
  {
    id: 60625,
    name: 'Rick and Morty',
    original_name: 'Rick and Morty',
    overview: 'Rory and Rick travel across infinite dimensions, causing chaos in parallel universes while dealing with high school drama and cosmic interdimensional bureaucrats.',
    poster_path: '/gd11S833k93e.jpg',
    backdrop_path: '/mR338k9e239.jpg',
    first_air_date: '2013-12-02',
    vote_average: 8.7,
    vote_count: 9800,
    popularity: 210.4,
    genre_ids: [16, 35, 878],
    genres: [{ id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' }, { id: 878, name: 'Sci-Fi' }],
    media_type: 'tv',
    number_of_seasons: 7,
    number_of_episodes: 71,
    status: 'Returning Series',
    couchlock_score: 98,
    chill_vibe: 'Visually Trippy',
    strain_pairing: 'Sour Diesel (Sativa)',
    cast: [
      { id: 1245, name: 'Justin Roiland', character: 'Rick Sanchez / Morty Smith', profile_path: '/roiland.jpg' },
      { id: 1246, name: 'Sarah Chalke', character: 'Beth Smith', profile_path: '/chalke.jpg' },
      { id: 1247, name: 'Chris Parnell', character: 'Jerry Smith', profile_path: '/parnell.jpg' }
    ]
  },
  {
    id: 1396,
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student.',
    poster_path: '/ztA933398.jpg',
    backdrop_path: '/bb8398239.jpg',
    first_air_date: '2008-01-20',
    vote_average: 8.9,
    vote_count: 14200,
    popularity: 245.1,
    genre_ids: [18, 80],
    genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
    media_type: 'tv',
    number_of_seasons: 5,
    number_of_episodes: 62,
    status: 'Ended',
    couchlock_score: 94,
    chill_vibe: 'Adrenaline Thrill',
    strain_pairing: 'OG Kush (Hybrid)',
    cast: [
      { id: 17419, name: 'Bryan Cranston', character: 'Walter White', profile_path: '/cranston.jpg' },
      { id: 84497, name: 'Aaron Paul', character: 'Jesse Pinkman', profile_path: '/paul.jpg' }
    ]
  },
  {
    id: 94605,
    name: 'Arcane',
    original_name: 'Arcane',
    overview: 'Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on opposing sides of a war between magical technologies and incompatible convictions.',
    poster_path: '/fqP333.jpg',
    backdrop_path: '/arcane_bg.jpg',
    first_air_date: '2021-11-06',
    vote_average: 9.0,
    vote_count: 4100,
    popularity: 195.8,
    genre_ids: [16, 14, 28, 18],
    genres: [{ id: 16, name: 'Animation' }, { id: 14, name: 'Fantasy' }],
    media_type: 'tv',
    number_of_seasons: 2,
    number_of_episodes: 18,
    couchlock_score: 97,
    chill_vibe: 'Visually Trippy',
    strain_pairing: 'Girl Scout Cookies (GSC)',
    cast: [
      { id: 10820, name: 'Hailee Steinfeld', character: 'Vi', profile_path: '/hailee.jpg' },
      { id: 10821, name: 'Ella Purnell', character: 'Jinx', profile_path: '/purnell.jpg' }
    ]
  },
  {
    id: 110492,
    name: 'Severance',
    original_name: 'Severance',
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
    poster_path: '/severance.jpg',
    backdrop_path: '/severance_bg.jpg',
    first_air_date: '2022-02-17',
    vote_average: 8.6,
    vote_count: 2800,
    popularity: 162.0,
    genre_ids: [878, 9648, 18],
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 9648, name: 'Mystery' }],
    media_type: 'tv',
    number_of_seasons: 2,
    number_of_episodes: 19,
    couchlock_score: 95,
    chill_vibe: 'Deep Mindbend',
    strain_pairing: 'Jack Herer (Sativa)',
    cast: [
      { id: 12001, name: 'Adam Scott', character: 'Mark Scout', profile_path: '/scott.jpg' },
      { id: 12002, name: 'Patricia Arquette', character: 'Harmony Cobel', profile_path: '/arquette.jpg' }
    ]
  }
];

export const WEED_STRAIN_MATCHES: WeedStrainMatch[] = [
  {
    id: 's1',
    strainName: 'Pineapple Express',
    strainType: 'Sativa',
    thcPercent: '24%',
    moodEffect: 'Energetic Euphoria & Fits of Laughter',
    description: 'The iconic tropical powerhouse. Perfect for high-energy buddy comedies, hilarious animated chaos, and action packed adventures.',
    recommendedGenres: ['Comedy', 'Action', 'Animation'],
    recommendedMovies: [MOCK_MOVIES[0], MOCK_SHOWS[0]]
  },
  {
    id: 's2',
    strainName: 'Granddaddy Purple',
    strainType: 'Indica',
    thcPercent: '27%',
    moodEffect: 'Heavy Body Lock & Deep Cosmic Contemplation',
    description: 'Deep physical relaxation paired with a dreamlike state. Tailor made for mind-bending sci-fi epics, wormholes, and 4K visual stunning journeys.',
    recommendedGenres: ['Sci-Fi', 'Adventure', 'Mystery'],
    recommendedMovies: [MOCK_MOVIES[1], MOCK_MOVIES[5]]
  },
  {
    id: 's3',
    strainName: 'Blue Dream',
    strainType: 'Hybrid',
    thcPercent: '22%',
    moodEffect: 'Balanced Sensory Heightening & Visual Wonder',
    description: 'Elevates visual appreciation and emotional resonance without couchlock. Ideal for multiverse marvels, gorgeous animations, and stylized thrillers.',
    recommendedGenres: ['Animation', 'Fantasy', 'Sci-Fi'],
    recommendedMovies: [MOCK_MOVIES[3], MOCK_SHOWS[2]]
  },
  {
    id: 's4',
    strainName: 'Northern Lights',
    strainType: 'Indica',
    thcPercent: '25%',
    moodEffect: 'Cozy Nostalgia & Zen Relaxation',
    description: 'Soothing body buzz that strips away stress. Great for cult classics, cozy comfort shows, and easygoing vintage films.',
    recommendedGenres: ['Comedy', 'Drama', 'Crime'],
    recommendedMovies: [MOCK_MOVIES[2], MOCK_SHOWS[1]]
  }
];

export const MOCK_COLLECTIONS: CollectionDetail[] = [
  {
    id: 131292,
    name: 'The Marvel Cinematic Universe - Infinity Saga',
    overview: 'The epic interconnected saga featuring Iron Man, Captain America, Thor, the Avengers, and Guardians of the Galaxy.',
    poster_path: '/mcu_poster.jpg',
    backdrop_path: '/mcu_bg.jpg',
    parts: MOCK_MOVIES.slice(0, 4)
  },
  {
    id: 420420,
    name: 'Ultimate High & Stoner Cult Classics',
    overview: 'Hand-picked legendary films made for late night sessions, endless laughs, and mind-expanding cinema.',
    poster_path: '/stoner_collection.jpg',
    backdrop_path: '/stoner_bg.jpg',
    parts: [MOCK_MOVIES[0], MOCK_MOVIES[2], MOCK_MOVIES[3], MOCK_MOVIES[5]]
  }
];
