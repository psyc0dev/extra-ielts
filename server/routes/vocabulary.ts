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

function extractSynonyms(html: string, originalWord: string): string[] {
  const synonyms: string[] = [];
  
  // Try multiple approaches to find synonyms
  
  // Approach 1: Look for the main synonyms list section
  const synonymsListMatch = html.match(/<div[^>]*class="thes-list-content[^"]*synonyms_list[^"]*"[^>]*>(.*?)<\/div>/s);
  if (synonymsListMatch) {
    const synonymsListHtml = synonymsListMatch[1];
    
    // Extract words from list items with class "thes-word-list-item"
    const listItemRegex = /<li[^>]*class="thes-word-list-item[^"]*"[^>]*>(.*?)<\/li>/gs;
    let match;
    
    while ((match = listItemRegex.exec(synonymsListHtml)) !== null) {
      const itemHtml = match[1];
      
      // Extract the word text, removing HTML tags
      const wordMatch = itemHtml.match(/<a[^>]*>(.*?)<\/a>/);
      if (wordMatch) {
        let word = wordMatch[1]
          .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
          .trim()
          .toLowerCase();
        
        // Clean up common HTML entities and extra spaces
        word = word.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (word && word.length > 2 && word !== originalWord.toLowerCase()) {
          synonyms.push(word);
        }
      }
    }
  }
  
  // Approach 2: Look for any list items that might contain synonyms
  if (synonyms.length < 4) {
    const allListItemsRegex = /<li[^>]*class="[^"]*word[^"]*"[^>]*>(.*?)<\/li>/gs;
    let match;
    
    while ((match = allListItemsRegex.exec(html)) !== null && synonyms.length < 4) {
      const itemHtml = match[1];
      
      // Extract the word text
      const wordMatch = itemHtml.match(/<a[^>]*>(.*?)<\/a>/);
      if (wordMatch) {
        let word = wordMatch[1]
          .replace(/<[^>]*>/g, '')
          .trim()
          .toLowerCase();
        
        word = word.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (word && word.length > 2 && word !== originalWord.toLowerCase() && !synonyms.includes(word)) {
          synonyms.push(word);
        }
      }
    }
  }
  
  // Approach 3: Try meta description as last resort
  if (synonyms.length === 0) {
    const metaDescriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="[^"]*Synonyms for[^:]*:([^"]*)"/i);
    if (metaDescriptionMatch) {
      const descriptionSynonyms = metaDescriptionMatch[1]
        .split(',')[0] // Take only the first part before semicolon
        .split(';')[0] // Take only the first part before semicolon
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 2 && s !== originalWord.toLowerCase());
      
      synonyms.push(...descriptionSynonyms.slice(0, 4));
    }
  }
  
  return synonyms.slice(0, 4); // Limit to 4 words from Merriam-Webster
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
    
    // Try Merriam-Webster first
    let similarWords: string[] = [];
    
    try {
      const mwResponse = await fetch(`https://www.merriam-webster.com/thesaurus/${encodeURIComponent(word)}`);
      if (mwResponse.ok) {
        const html = await mwResponse.text();
        similarWords = extractSynonyms(html, word);
      }
    } catch (error) {
      console.log('Merriam-Webster API failed:', error);
    }
    
    // If no synonyms found from Merriam-Webster, try Free Dictionary as fallback
    if (similarWords.length === 0) {
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
            const allSynonyms: string[] = [];
            meanings.forEach((meaning) => {
              const synonyms = meaning.synonyms || [];
              allSynonyms.push(...synonyms);
            });
            similarWords = allSynonyms.slice(0, 4); // Limit to 4 words from Free Dictionary
          }
        }
      } catch (error) {
        console.log('Free Dictionary API failed:', error);
      }
    }
    
    // If still no synonyms found, return empty array
    if (similarWords.length === 0) {
      return c.json({
        success: true,
        data: {
          word,
          similarWords: []
        }
      });
    }
    
    // Remove duplicates and limit results
    const uniqueWords = [...new Set(similarWords)]
      .filter(w => w.toLowerCase() !== word.toLowerCase())
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
