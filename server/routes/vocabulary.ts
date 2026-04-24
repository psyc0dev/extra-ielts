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
    throw error;
  }
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

// Get similar words for a word
router.get('/similar/:word', async (c) => {
  try {
    const { word } = c.req.param();
    
    // Try multiple APIs for similar words
    const similarWords: string[] = [];
    
    // API 1: WordsAPI (if available)
    try {
      const wordsApiResponse = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=5`);
      if (wordsApiResponse.ok) {
        const wordsData = await wordsApiResponse.json() as Array<{ word: string }>;
        similarWords.push(...wordsData.map((item) => item.word));
      }
    } catch (error) {
      console.log('WordsAPI failed:', error);
    }
    
    // API 2: Datamuse for related words
    try {
      const datamuseResponse = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=5`);
      if (datamuseResponse.ok) {
        const datamuseData = await datamuseResponse.json() as Array<{ word: string }>;
        similarWords.push(...datamuseData.map((item) => item.word));
      }
    } catch (error) {
      console.log('Datamuse API failed:', error);
    }
    
    // API 3: Free Dictionary API for synonyms
    try {
      const freeDictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (freeDictResponse.ok) {
        const freeDictData = await freeDictResponse.json() as Array<{
          meanings: Array<{
            synonyms: string[];
          }>;
        }>;
        if (Array.isArray(freeDictData) && freeDictData.length > 0) {
          const meanings = freeDictData[0]?.meanings || [];
          meanings.forEach((meaning) => {
            const synonyms = meaning.synonyms || [];
            similarWords.push(...synonyms.slice(0, 3)); // Limit to avoid too many results
          });
        }
      }
    } catch (error) {
      console.log('Free Dictionary API failed:', error);
    }
    
    // Remove duplicates and the original word
    const uniqueWords = [...new Set(similarWords)]
      .filter(w => w.toLowerCase() !== word.toLowerCase())
      .filter(w => w.length > 2) // Filter out very short words
      .slice(0, 8); // Limit to 8 similar words
    
    return c.json({
      success: true,
      data: {
        word,
        similarWords: uniqueWords
      }
    });
  } catch (error) {
    console.error('Error fetching similar words:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch similar words'
    }, 500);
  }
});

export function registerVocabularyRoutes(app: any) {
  app.route('/vocabulary', router);
}

export default router;
