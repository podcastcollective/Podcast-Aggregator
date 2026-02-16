// api/episodes.js
// Vercel Serverless Function for fetching all episodes of a podcast

const fetch = require('node-fetch');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { podcast_id, limit = 100, offset = 0 } = req.query;

  if (!podcast_id) {
    return res.status(400).json({ 
      error: 'podcast_id is required' 
    });
  }

  try {
    const lookupResponse = await fetch(
      `https://itunes.apple.com/lookup?id=${podcast_id}&entity=podcastEpisode&limit=200`
    );
    const lookupData = await lookupResponse.json();

    if (!lookupData.results || lookupData.results.length === 0) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    const podcastInfo = lookupData.results[0];
    let episodes = lookupData.results.slice(1).map(ep => ({
      id: ep.trackId?.toString(),
      title: ep.trackName,
      description: ep.description,
      release_date: ep.releaseDate,
      duration_ms: ep.trackTimeMillis,
      duration_formatted: formatDuration(ep.trackTimeMillis),
      url: ep.trackViewUrl,
      audio_url: ep.previewUrl,
      artwork: ep.artworkUrl600 || ep.artworkUrl160,
    }));

    // Apply pagination
    const total = episodes.length;
    const paginatedEpisodes = episodes.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );

    // Add episode analytics
    const analytics = generateEpisodeAnalytics(episodes);

    return res.status(200).json({
      podcast_id: podcast_id,
      total_episodes: total,
      offset: parseInt(offset),
      limit: parseInt(limit),
      episodes: paginatedEpisodes,
      analytics: analytics
    });

  } catch (error) {
    console.error('Episodes fetch error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch episodes',
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

function generateEpisodeAnalytics(episodes) {
  if (episodes.length === 0) {
    return null;
  }

  const durations = episodes
    .map(ep => ep.duration_ms / 1000)
    .filter(d => d > 0);

  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;

  const dates = episodes
    .map(ep => new Date(ep.release_date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => b - a);

  let avgDaysBetween = null;
  if (dates.length > 1) {
    const intervals = [];
    for (let i = 0; i < Math.min(dates.length - 1, 20); i++) {
      const days = (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    avgDaysBetween = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  return {
    total_episodes: episodes.length,
    average_duration_seconds: Math.round(avgDuration),
    average_duration_formatted: formatDuration(avgDuration * 1000),
    first_episode_date: dates.length > 0 ? dates[dates.length - 1].toISOString() : null,
    latest_episode_date: dates.length > 0 ? dates[0].toISOString() : null,
    average_days_between_episodes: avgDaysBetween ? Math.round(avgDaysBetween) : null,
    publishing_frequency: estimateFrequency(avgDaysBetween)
  };
}

function estimateFrequency(avgDays) {
  if (!avgDays) return 'unknown';
  if (avgDays <= 1.5) return 'daily';
  if (avgDays <= 4) return 'multiple times per week';
  if (avgDays <= 9) return 'weekly';
  if (avgDays <= 18) return 'biweekly';
  if (avgDays <= 35) return 'monthly';
  return 'irregular';
}
```

Commit changes.

---

## ✅ That's It! Now Deploy to Vercel

1. **Go to Vercel:** https://vercel.com/new
2. **Import your GitHub repository** (podcast-aggregator)
3. **Click Deploy**
4. **Wait 60 seconds**
5. **Done!** 🎉

Your API will be live at: `https://podcast-aggregator-XXXXX.vercel.app`

---

## 🧪 Test Your API

Replace `YOUR-URL` with your actual Vercel URL:
```
https://YOUR-URL.vercel.app/api/search/podcasts?query=tech&limit=5
