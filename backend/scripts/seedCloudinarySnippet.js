// backend/scripts/seedCloudinarySnippets.js
// Run: node backend/scripts/seedCloudinarySnippets.js
// why: insert real Cloudinary MP3s; difficulty is derived from snippet length

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Snippet = require('../models/Snippet');

function difficultyFromSize(n) {
  if (n === 3) return 'hard';
  if (n === 5) return 'medium';
  if (n === 10) return 'easy';
  return 'medium';
}

// Edit titles/artists/sizes as you like
const SNIPPETS = [
  {
    title: 'American Wedding',
    artist: 'Frank Ocean',
    snippetSize: 5, // medium
    audioUrl:
      'https://res.cloudinary.com/dqyszqny2/video/upload/v1752842093/frank_ocean_-_american_wedding_cbhyl3.mp3',
  },
  {
    title: 'Always',
    artist: 'Daniel Caesar',
    snippetSize: 10, // easy
    audioUrl:
      'https://res.cloudinary.com/dqyszqny2/video/upload/v1752841982/Daniel_Caesar_-_Always_Official_Audio_utjl8d.mp3',
  },
  {
    title: 'Gold Digger (feat. Jamie Foxx)',
    artist: 'Kanye West',
    snippetSize: 3, // hard
    audioUrl:
      'https://res.cloudinary.com/dqyszqny2/video/upload/v1752841925/Kanye_West_-_Gold_Digger_ft._Jamie_Foxx_iqlxgv.mp3',
  },
  {
    title: 'Feel No Ways',
    artist: 'Drake',
    snippetSize: 5, // medium
    audioUrl:
      'https://res.cloudinary.com/dqyszqny2/video/upload/v1752841757/Drake_-_Feel_No_Ways_bneccn.mp3',
  },
  {
    title: "Can't Help Falling in Love",
    artist: 'Elvis Presley', // adjust if you prefer another artist/cover
    snippetSize: 10, // easy
    audioUrl:
      'https://res.cloudinary.com/dqyszqny2/video/upload/v1752841413/Can_t_Help_Falling_in_Love_q7mtyu.mp3',
  },
];

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) {
    console.error('[seed] Missing MONGO_URI in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[seed] connected');

  for (const s of SNIPPETS) {
    const doc = {
      title: s.title,
      artist: s.artist,
      genre: undefined,
      difficulty: difficultyFromSize(s.snippetSize), // derived
      snippetSize: s.snippetSize,
      type: 'classic',
      audioUrl: s.audioUrl,
    };
    const res = await Snippet.updateOne(
      { title: s.title, artist: s.artist, snippetSize: s.snippetSize },
      { $set: doc },
      { upsert: true }
    );
    console.log(
      '[seed] upsert',
      s.title,
      s.artist,
      s.snippetSize,
      res.upsertedId ? 'created' : 'updated'
    );
  }

  // Show inventory by size so frontend can pick lengths that exist
  const rows = await Snippet.aggregate([
    { $match: { type: 'classic' } },
    { $group: { _id: { snippetSize: '$snippetSize' }, count: { $sum: 1 } } },
    { $sort: { '_id.snippetSize': 1 } },
  ]).exec();
  console.table(
    rows.map(r => ({
      snippetSize: r._id.snippetSize,
      difficulty: difficultyFromSize(r._id.snippetSize),
      count: r.count,
    }))
  );

  await mongoose.disconnect();
  console.log('[seed] done');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
