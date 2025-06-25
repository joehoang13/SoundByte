const Snippet = require('../models/Snippet');

exports.getSnippetDummy = async (req, res) => {
  const dummySnippet = {
    title: "Power",
    artist: "Kanye West",
    genre: "Hip-Hop",
    difficulty: "medium",
    snippetSize: 5,
    type: "classic",
    audioUrl: "https://example.com/audio/kanye_power_snippet.mp3",
    createdAt: new Date("2025-06-20T14:00:00Z"),
  };


  res.json(dummySnippet);
};

  