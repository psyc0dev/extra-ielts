import { Hono } from 'hono';
import { shuffle } from '../utils/helpers';

const router = new Hono();

interface IeltsWord {
  word: string;
  meaning: string;
}

const IELTS_4000_URL = 'https://raw.githubusercontent.com/psyc0dev/ielts_words/refs/heads/main/IELTS-4000.txt';

let cachedWords: IeltsWord[] | null = null;

async function fetchIeltsWords(): Promise<IeltsWord[]> {
  if (cachedWords) {
    return cachedWords;
  }

  try {
    const response = await fetch(IELTS_4000_URL);
    if (!response.ok) {
      if (response.status === 401) {
        console.error('Unauthorized access to IELTS words. Using fallback words.');
        return getFallbackWords();
      }
      throw new Error(`Failed to fetch IELTS words: ${response.status}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    const words: IeltsWord[] = lines.map(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        return null;
      }
      
      const word = line.substring(0, colonIndex).trim();
      const meaning = line.substring(colonIndex + 1).trim();
      
      return { word, meaning };
    }).filter((item): item is IeltsWord => item !== null);
    
    cachedWords = words;
    return words;
  } catch (error) {
    console.error('Error fetching IELTS words:', error);
    return getFallbackWords();
  }
}

function getFallbackWords(): IeltsWord[] {
  return [
    { word: "achieve", meaning: "to successfully reach a goal" },
    { word: "adapt", meaning: "to change to fit a new situation" },
    { word: "adequate", meaning: "enough or satisfactory for a purpose" },
    { word: "allocate", meaning: "to distribute resources for a purpose" },
    { word: "analyze", meaning: "to examine something in detail" },
    { word: "approach", meaning: "to deal with a situation or problem" },
    { word: "assess", meaning: "to evaluate or estimate the nature of something" },
    { word: "benefit", meaning: "an advantage or profit gained from something" },
    { word: "concept", meaning: "an abstract idea or general notion" },
    { word: "contribute", meaning: "to help cause or bring about something" },
    { word: "create", meaning: "to bring something into existence" },
    { word: "define", meaning: "to state or describe the exact nature of something" },
    { word: "develop", meaning: "to grow or cause to grow and become more mature" },
    { word: "effect", meaning: "a change which is a result or consequence of an action" },
    { word: "establish", meaning: "to set up on a firm or permanent basis" },
    { word: "factor", meaning: "a circumstance or fact that contributes to a result" },
    { word: "function", meaning: "the natural purpose of something or someone" },
    { word: "identify", meaning: "to establish or indicate who or what someone or something is" },
    { word: "implement", meaning: "to put a decision or plan into effect" },
    { word: "indicate", meaning: "to point out or show something" }
  ];
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

// Get a new vocabulary test
router.get('/test', async (c) => {
  try {
    const words = await fetchIeltsWords();
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
router.get('/dictionary/:word', async (c) => {
  try {
    const { word } = c.req.param();
    const response = await fetch(
      `https://dictionary-api.eliaschen.dev/api/dictionary/en/${encodeURIComponent(word)}`
    );
    
    if (!response.ok) {
      return c.json({
        success: true,
        data: null
      });
    }
    
    const data = await response.json();
    return c.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching dictionary entry:', error);
    return c.json({
      success: true,
      data: null
    });
  }
});

export function registerVocabularyRoutes(app: any) {
  app.route('/api/vocabulary', router);
}

export default router;
