// api/search/episodes.js
// Vercel Serverless Function for searching episodes across podcasts

const fetch = require('node-fetch');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { query, limit = 50, podcast_id } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    let searchUrl;
    
    if (podcast_id) {
      // Search within a specific podcast
      searchUrl = `https://itunes.apple.com/lookup?id=${podcast_id}&entity=podcastEpisode&limit=200`;
    } else {
      // Search across all podcasts for episodes
      searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcastEpisode&limit=${limit}`;
    }

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.status(200).json({
        results: [],
        result_count: 0,
        query: query
      });
    }

    // Filter and format episodes
    let episodes = data.results
      .filter(item => item.kind === 'podcast-episode' || item.wrapperType === 'podcastEpisode')
      .map(episode => ({
        episode_id: episode.trackId?.toString(),
        podcast_id: episode.collectionId?.toString(),
        podcast_name: episode.collectionName,
        podcast_publisher: episode.artistName,
        
        title: episode.trackName,
        description: episode.description,
        
        release_date: episode.releaseDate,
        duration_ms: episode.trackTimeMillis,
        duration_formatted: formatDuration(episode.trackTimeMillis),
        
        url: episode.trackViewUrl,
        audio_url: episode.episodeUrl || episode.previewUrl,
        
        artwork: {
          small: episode.artworkUrl60,
          medium: episode.artworkUrl160,
          large: episode.artworkUrl600
        },
        
        content_rating: episode.contentAdvisoryRating,
        country: episode.country,
        
        genres: episode.genres || [],
        primary_genre: episode.primaryGenreName
      }));

    // If searching within a podcast, filter by query in title/description
    if (podcast_id && query) {
      const queryLower = query.toLowerCase();
      episodes = episodes.filter(ep => 
        ep.title?.toLowerCase().includes(queryLower) || 
        ep.description?.toLowerCase().includes(queryLower)
      );
    }

    // Sort by release date (newest first)
    episodes.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

    return res.status(200).json({
      results: episodes,
      result_count: episodes.length,
      query: query,
      podcast_id: podcast_id || null
    });

  } catch (error) {
    console.error('Episode search error:', error);
    return res.status(500).json({ 
      error: 'Failed to search episodes',
      message: error.message 
    });
  }
}

function formatDuration(ms) {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
