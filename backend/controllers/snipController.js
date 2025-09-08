const Snippet = require('../models/Snippet');

exports.getSnippetDummy = async (req, res) => {
  const dummySnippet = {
    title: 'Power',
    artist: 'Kanye West',
    genre: 'Hip-Hop',
    difficulty: 'medium',
    snippetSize: 5,
    type: 'classic',
    audioUrl: 'https://example.com/audio/kanye_power_snippet.mp3',
    createdAt: new Date('2025-06-20T14:00:00Z'),
  };

  res.json(dummySnippet);
};

exports.findSnippetByTitleAndArtist = async (req, res) => {
  try {
    const { title, artist } = req.query;

    if (!title || !artist) {
      return res.status(400).json({ error: 'Both title and artist are required.' });
    }

    const snippet = await Snippet.findOne({ title, artist });

    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found.' });
    }

    res.status(200).json(snippet);
  } catch (err) {
    console.error('Error trying to find snippet by Title and Artist:', err);
    res.status(500).json({ error: 'Server error while fetching snippet.' });
  }
};

exports.getRandomSnippetByDifficulty = async (req, res) => {
  try {
    const { difficulty } = req.query;
    if (!difficulty) return res.status(400).json({ error: 'Difficulty is required.' });

    const [result] = await Snippet.aggregate([
      { $match: { difficulty } },
      { $sample: { size: 1 } },
      {
        $project: {
          _id: 0,
          title: 1,
          artist: 1,
          genre: 1,
          type: 1,
          difficulty: 1,
          audioUrl: 1,
          createdAt: 1,
        },
      },
    ]);


    if (!result) return res.status(404).json({ message: 'No snippet found.' });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getRandomSnippetByGenre = async (req, res) => {
  try {
    const { genre } = req.query;
    if (!genre) return res.status(400).json({ error: 'Genre is required.' });

    const [result] = await Snippet.aggregate([
      { $match: { genre } },
      { $sample: { size: 1 } },
      {
        $project: {
          _id: 0,
          title: 1,
          artist: 1,
          genre: 1,
          type: 1,
          difficulty: 1,
          audioUrl: 1,
          createdAt: 1,
        },
      },
    ]);


    if (!result) return res.status(404).json({ message: 'No snippet found.' });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
};

exports.getRandomSnippet = async (req, res) => {
  try {
    const [snippet] = await Snippet.aggregate([{ $sample: { size: 1 } }]);

    if (!snippet) {
      return res.status(404).json({ message: 'No snippet found.' });
    }

    res.status(200).json(snippet);
  } catch (err) {
    console.error('Error fetching random snippet:', err);
    res.status(500).json({ error: 'Server error while fetching snippet.' });
  }
};
