// api/search/podcasts.js
// Vercel Serverless Function for podcast search

const fetch = require('node-fetch');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { query, limit = 50, country = 'us', entity = 'podcast' } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    // Search iTunes/Apple Podcasts API
    const itunesResponse = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=${entity}&limit=${limit}&country=${country}`
    );
    const itunesData = await itunesResponse.json();

    // Enrich results with additional metadata
    const enrichedResults = await Promise.all(
      (itunesData.results || []).map(async (podcast) => {
        try {
          // Get detailed info from iTunes lookup
          const lookupResponse = await fetch(
            `https://itunes.apple.com/lookup?id=${podcast.collectionId}&entity=podcastEpisode&limit=10`
          );
          const lookupData = await lookupResponse.json();
          
          const recentEpisodes = lookupData.results?.slice(1, 6) || [];
          
          // Estimate listener count based on ratings
          const estimatedListeners = estimateListeners(podcast.trackCount, podcast.primaryGenreName);

          return {
            id: podcast.collectionId.toString(),
            name: podcast.collectionName,
            publisher: podcast.artistName,
            description: podcast.collectionCensoredName,
            artwork: {
              small: podcast.artworkUrl60,
              medium: podcast.artworkUrl100,
              large: podcast.artworkUrl600
            },
            feed_url: podcast.feedUrl,
            itunes_url: podcast.collectionViewUrl,
            genres: podcast.genreIds?.map((id, idx) => podcast.genres?.[idx]) || [],
            primary_genre: podcast.primaryGenreName,
            episode_count: podcast.trackCount || 0,
            country: podcast.country,
            language: podcast.languageCodesISO2A?.[0] || 'en',
            release_date: podcast.releaseDate,
            content_rating: podcast.contentAdvisoryRating || 'clean',
            estimated_listeners: estimatedListeners,
            recent_episodes: recentEpisodes.map(ep => ({
              id: ep.trackId?.toString(),
              title: ep.trackName,
              description: ep.description,
              release_date: ep.releaseDate,
              duration: ep.trackTimeMillis,
              url: ep.trackViewUrl
            }))
          };
        } catch (err) {
          console.error('Error enriching podcast:', err);
          return {
            id: podcast.collectionId.toString(),
            name: podcast.collectionName,
            publisher: podcast.artistName,
            error: 'Partial data available'
          };
        }
      })
    );

    return res.status(200).json({
      results: enrichedResults,
      result_count: enrichedResults.length,
      query: query
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ 
      error: 'Failed to search podcasts',
      message: error.message 
    });
  }
}

// Helper function to estimate listeners
function estimateListeners(episodeCount, genre) {
  // Very rough estimation based on episode count and genre popularity
  const baseMultiplier = {
    'True Crime': 15000,
    'News': 12000,
    'Comedy': 10000,
    'Business': 8000,
    'Technology': 7000,
    'Sports': 9000,
    'Health & Fitness': 6000,
    'Education': 5000,
    'Society & Culture': 5500,
    'default': 4000
  };

  const multiplier = baseMultiplier[genre] || baseMultiplier.default;
  const episodeFactor = Math.min(episodeCount / 100, 5);
  
  return Math.floor(multiplier * (1 + episodeFactor));
}
