function normalize(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD') // normalize unicode (á → a)
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[b.length][a.length];
}

function similarity(a, b) {
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function hasSharedWords(g, target) {
  const gw = g.split(' ');
  const tw = target.split(' ');
  return tw.some(word => gw.includes(word));
}

function strictMatch(guessRaw, answerRaw) {
  const g = normalize(guessRaw);
  const a = normalize(answerRaw);

  if (g.length < Math.ceil(a.length * 0.4)) return false; // too short
  if (!hasSharedWords(g, a)) return false; // no overlap
  if (similarity(g, a) < 0.75) return false; // not close enough
  return true;
}

function titleArtistMatch(guess, title, artist) {
  const titleHit = strictMatch(guess, title);
  const artistHit = strictMatch(guess, artist);
  const correct = titleHit || artistHit;
  return { titleHit, artistHit, correct };
}

module.exports = {
  normalize,
  titleArtistMatch,
};
