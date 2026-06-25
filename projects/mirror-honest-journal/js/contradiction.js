// Contradiction detection engine
// Scans past entries for statements that conflict with the current entry

import { POSITIVE_WORDS, NEGATIVE_WORDS, detectThemes } from './prompts.js';

// Extract meaningful "claim sentences" from text
function extractClaims(text) {
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]*/g) || [text];
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 300);
}

// Get polarity signature for a text chunk (+1 positive, -1 negative, 0 neutral)
function polarity(text) {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  if (pos > neg) return 1;
  if (neg > pos) return -1;
  return 0;
}

// Extract topic words (nouns / key terms) for overlap detection
function topicWords(text) {
  // Strip stop words, get meaningful tokens
  const stopWords = new Set([
    'i','me','my','we','you','he','she','it','they','the','a','an','is','are','was',
    'were','be','been','have','has','had','do','does','did','will','would','could',
    'should','may','might','can','and','or','but','so','if','when','that','this',
    'to','of','in','on','at','for','with','about','from','by','as','not','no',
    '我','你','他','她','它','的','了','是','在','有','不','也','都','和','就',
    '很','但','如果','因为','所以','这','那','个','会','要','把','对',
  ]);
  return text.toLowerCase()
    .replace(/[^\w一-鿿\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

// Jaccard similarity between two word sets
function overlap(wordsA, wordsB) {
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Main: find past entries that contradict the current text
// Returns array of { entry, quote, reason } objects
export function findContradictions(currentText, pastEntries, maxResults = 3) {
  if (!currentText.trim() || pastEntries.length === 0) return [];

  const currentThemes = new Set(detectThemes(currentText));
  const currentPolarity = polarity(currentText);
  const currentTopics = topicWords(currentText);
  const currentClaims = extractClaims(currentText);

  const results = [];

  for (const entry of pastEntries) {
    const entryText = entry.content || '';
    if (!entryText.trim()) continue;

    const entryThemes = new Set(detectThemes(entryText));
    const entryPolarity = polarity(entryText);
    const entryTopics = topicWords(entryText);

    // Check theme overlap
    const themeOverlap = [...currentThemes].filter(t => entryThemes.has(t));
    if (themeOverlap.length === 0) continue;

    // Check topic overlap
    const topicSim = overlap(currentTopics, entryTopics);
    if (topicSim < 0.05) continue;

    // Polarity flip is the key signal
    const polarityFlip = currentPolarity !== 0 && entryPolarity !== 0 && currentPolarity !== entryPolarity;

    if (!polarityFlip && topicSim < 0.12) continue;

    // Find the best quote from the past entry
    const entryClaims = extractClaims(entryText);
    let bestQuote = null;
    let bestScore = 0;

    for (const claim of entryClaims) {
      const claimTopics = topicWords(claim);
      const sim = overlap(currentTopics, claimTopics);
      const claimPolarity = polarity(claim);
      const score = sim * (polarityFlip && claimPolarity !== currentPolarity ? 2 : 1);
      if (score > bestScore) {
        bestScore = score;
        bestQuote = claim.trim();
      }
    }

    if (!bestQuote || bestScore < 0.02) {
      // Fall back to the first meaningful sentence
      bestQuote = entryClaims[0] || entryText.slice(0, 120);
    }

    // Build a human-readable reason
    let reason = '';
    if (polarityFlip) {
      reason = currentPolarity === 1
        ? '你今天持正面态度，但过去记录了相反的感受。'
        : '你今天持负面态度，但过去有更积极的看法。';
    } else {
      reason = `与今天的「${themeOverlap.map(t => t).join('、')}」主题相关，立场可能有变化。`;
    }

    results.push({
      entryId: entry.id,
      date: entry.date,
      quote: bestQuote,
      reason,
      score: bestScore + (polarityFlip ? 0.5 : 0),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}
