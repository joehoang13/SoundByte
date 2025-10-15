// backend/utils/scoringUtils.js
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleArtistMatch(guess, title, artist) {
  const g = normalize(guess);
  const t = normalize(title || '');
  const a = normalize(artist || '');
  if (!g) return { titleHit: false, artistHit: false, correct: false };

  const directTitle = t.includes(g) || g.includes(t);
  const directArtist = a.includes(g) || g.includes(a);

  const tokenHit = (needle, hay) => {
    const toks = needle.split(' ').filter(s => s.length > 1);
    if (!toks.length) return false;
    const hits = toks.filter(tok => hay.includes(tok)).length;
    return hits >= Math.min(2, toks.length) || hits / toks.length >= 0.6;
  };

  const titleHit = directTitle || tokenHit(g, t);
  const artistHit = directArtist || tokenHit(g, a);

  return { titleHit, artistHit, correct: titleHit || artistHit };
}

module.exports = { normalize, titleArtistMatch };
