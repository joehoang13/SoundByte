// Use CJS model directly (no src/ path)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Snippet = require('../../models/Snippet');

export async function seedSnippets() {
  return Snippet.insertMany([
    {
      title: 'Song A',
      artist: 'Artist X',
      genre: 'pop',
      difficulty: 'easy',
      snippetSize: 5,
      type: 'classic',
      audioUrl: 'https://example.com/a.mp3',
    },
    {
      title: 'Song B',
      artist: 'Artist Y',
      genre: 'rock',
      difficulty: 'easy',
      snippetSize: 5,
      type: 'classic',
      audioUrl: 'https://example.com/b.mp3',
    },
    {
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      genre: 'pop',
      difficulty: 'easy',
      snippetSize: 5,
      type: 'classic',
      audioUrl: 'https://example.com/wknd.mp3',
    },
  ]);
}
