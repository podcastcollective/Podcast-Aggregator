// api/podcasts/[id].js
// Vercel Serverless Function for podcast details

const fetch = require('node-fetch');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Podcast ID is required' });
  }

  try {
    // Lookup podcast from iTunes
    const lookupResponse = await fetch(
      `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=200`
    );
    const lookupData = await lookupResponse.json();

    if (!lookupData.results || lookupData.results.length === 0) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    const podcastInfo = lookupData.results[0];
    const episodes = lookupData.results.slice(1);

    // Analyze episodes for insights
    const episodeAnalysis = analyzeEpisodes(episodes);

    // Compile comprehensive podcast data
    const podcastDetails = {
      id: podcastInfo.collectionId.toString(),
      name: podcastInfo.collectionName,
      publisher: podcastInfo.artistName,
      description: podcastInfo.collectionCensoredName,
      
      artwork: {
        url_60: podcastInfo.artworkUrl60,
        url_100: podcastInfo.artworkUrl100,
        url_600: podcastInfo.artworkUrl600,
      },

      metadata: {
        feed_url: podcastInfo.feedUrl,
        itunes_url: podcastInfo.collectionViewUrl,
        itunes_id: podcastInfo.collectionId,
        copyright: null,
        author: podcastInfo.artistName,
      },

      categories: {
        genres: podcastInfo.genres || [],
        primary_genre: podcastInfo.primaryGenreName,
      },

      stats: {
        episode_count: podcastInfo.trackCount || episodes.length,
        release_date: podcastInfo.releaseDate,
        latest_episode_date: episodes[0]?.releaseDate,
        country: podcastInfo.country,
        language: podcastInfo.languageCodesISO2A?.[0] || 'en',
        explicit: podcastInfo.contentAdvisoryRating === 'Explicit',
      },

      episode_insights: episodeAnalysis,

      recent_episodes: episodes.slice(0, 10).map(ep => ({
        id: ep.trackId?.toString(),
        title: ep.trackName,
        description: ep.description?.substring(0, 200) || '',
        release_date: ep.releaseDate,
        duration: ep.trackTimeMillis,
        url: ep.trackViewUrl,
      })),

      estimated_metrics: estimateMetrics(podcastInfo, episodes.length)
    };

    return res.status(200).json(podcastDetails);

  } catch (error) {
    console.error('Podcast details error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch podcast details',
      message: error.message 
    });
  }
}

function analyzeEpisodes(episodes) {
  if (episodes.length === 0) {
    return null;
  }

  const durations = episodes
    .map(ep => ep.trackTimeMillis / 1000)
    .filter(d => d > 0);

  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;

  // Calculate publishing frequency
  const dates = episodes
    .map(ep => new Date(ep.releaseDate))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b - a);

  let avgDaysBetween = null;
  if (dates.length > 1) {
    const intervals = [];
    for (let i = 0; i < Math.min(dates.length - 1, 10); i++) {
      const days = (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    avgDaysBetween = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  return {
    average_duration_seconds: Math.round(avgDuration),
    average_duration_minutes: Math.round(avgDuration / 60),
    publishing_frequency_days: avgDaysBetween ? Math.round(avgDaysBetween) : null,
    estimated_schedule: estimateSchedule(avgDaysBetween),
    total_analyzed: episodes.length
  };
}

function estimateSchedule(avgDays) {
  if (!avgDays) return 'unknown';
  if (avgDays <= 1.5) return 'daily';
  if (avgDays <= 4) return '2-3 times per week';
  if (avgDays <= 9) return 'weekly';
  if (avgDays <= 18) return 'biweekly';
  if (avgDays <= 35) return 'monthly';
  return 'irregular';
}

function estimateMetrics(podcast, episodeCount) {
  const genreMultipliers = {
    'True Crime': 2.5,
    'News': 2.0,
    'Comedy': 1.8,
    'Business': 1.6,
    'Technology': 1.5,
    'Sports': 1.7,
    'Health & Fitness': 1.4,
    'default': 1.0
  };

  const multiplier = genreMultipliers[podcast.primaryGenreName] || genreMultipliers.default;
  const episodeFactor = Math.log10(episodeCount + 1);
  
  const baseListeners = 5000;
  const estimatedWeeklyListeners = Math.floor(baseListeners * multiplier * episodeFactor);
  const estimatedDownloadsPerEpisode = Math.floor(estimatedWeeklyListeners * 0.7);

  return {
    estimated_weekly_listeners: estimatedWeeklyListeners,
    estimated_downloads_per_episode: estimatedDownloadsPerEpisode,
    confidence: 'low',
    note: 'Estimates based on genre, episode count, and industry averages'
  };
}
