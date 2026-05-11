import { Hono } from 'hono';
import { shuffle } from '../utils/helpers';
import { requireAuth } from '../lib/store';
import type { AppEnv } from '../lib/types';

const router = new Hono<AppEnv>();

interface IeltsWord {
  word: string;
  meaning: string;
}

const WORDS_URL = 'https://raw.githubusercontent.com/psyc0dev/ielts_words/refs/heads/main/IELTS-4000.txt';

let cachedWords: IeltsWord[] | null = null;

async function fetchWords(): Promise<IeltsWord[]> {
  if (cachedWords) return cachedWords;

  const response = await fetch(WORDS_URL);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

  const text = await response.text();
  const words = text.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const i = line.indexOf(':');
      if (i === -1) return null;
      return { word: line.slice(0, i).trim(), meaning: line.slice(i + 1).trim() };
    })
    .filter((w): w is IeltsWord => !!w?.word && !!w.meaning);

  cachedWords = words;
  return words;
}

function pickDistractors(correct: IeltsWord, pool: IeltsWord[], count: number): string[] {
  const others = pool.filter((w) => w.word !== correct.word);
  const shuffled = shuffle(others);
  return shuffled.slice(0, count).map((w) => w.meaning);
}

function buildOptions(correct: IeltsWord, pool: IeltsWord[]): string[] {
  const distractors = pickDistractors(correct, pool, 4);
  return shuffle([correct.meaning, ...distractors]);
}

function extractSynonyms(html: string, word: string): string[] {
  const synonyms: string[] = [];
  const match = html.match(/class="thes-list-content[^"]*synonyms_list[^"]*"[^>]*>([^<]{0,5000})/);
  if (!match) return synonyms;

  let idx = match[1].indexOf('<a');
  while (idx !== -1 && synonyms.length < 8) {
    const end = match[1].indexOf('</a>', idx);
    if (end === -1) break;
    const content = match[1].slice(idx, end);
    const gt = content.indexOf('>');
    if (gt !== -1) {
      const w = content.slice(gt + 1).replace(/&nbsp;/g, ' ').trim().toLowerCase();
      if (w.length > 2 && w !== word.toLowerCase() && !synonyms.includes(w)) synonyms.push(w);
    }
    idx = match[1].indexOf('<a', end);
  }
  return synonyms;
}

// Get a new vocabulary test
router.get('/test', requireAuth, async (c) => {
  try {
    const words = await fetchWords();
    const shuffled = shuffle(words);
    const testWords = shuffled.slice(0, 20);
    
    const test = testWords.map(word => ({
      word: word.word,
      meaning: word.meaning,
      options: buildOptions(word, testWords)
    }));
    
    return c.json({
      success: true,
      data: {
        words: test,
        total: test.length
      }
    });
  } catch (error) {
    console.error('Error generating vocabulary test:', error);
    return c.json({
      success: false,
      error: 'Failed to generate vocabulary test'
    }, 500);
  }
});

// Get dictionary entry for a word
router.get('/dictionary/:word', requireAuth, async (c) => {
  const word = c.req.param('word');
  try {
    const res = await fetch(`https://dictionary-api.eliaschen.dev/api/dictionary/en/${encodeURIComponent(word)}`);
    const data = await res.json().catch(() => null);
    return c.json({ success: res.ok, data });
  } catch {
    return c.json({ success: false, error: 'Service error' }, 500);
  }
});

// Get similar words for a word
router.get('/similar/:word', requireAuth, async (c) => {
  const word = c.req.param('word');
  const synonyms: string[] = [];

  // Try Merriam-Webster
  try {
    const res = await fetch(`https://www.merriam-webster.com/thesaurus/${encodeURIComponent(word)}`);
    if (res.ok) synonyms.push(...extractSynonyms(await res.text(), word));
  } catch {}

  // Fallback to Free Dictionary
  if (synonyms.length === 0) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (res.ok) {
        const data = await res.json() as Array<{ meanings?: Array<{ synonyms?: string[] }> }>;
        if (data?.[0]?.meanings) {
          synonyms.push(...data[0].meanings.flatMap(m => m.synonyms || []).slice(0, 4));
        }
      }
    } catch {}
  }

  const unique = [...new Set(synonyms)]
    .filter(w => w.toLowerCase() !== word.toLowerCase())
    .slice(0, 8);

  return c.json({ success: true, data: { word, similarWords: unique } });
});

export function registerVocabularyRoutes(app: Hono<AppEnv>) {
  app.route('/vocabulary', router);
}

export default router;
