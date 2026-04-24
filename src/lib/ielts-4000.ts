// IELTS-4000 words from GitHub repository
export interface IeltsWord {
  word: string;
  meaning: string;
}

const IELTS_4000_URL = 'https://raw.githubusercontent.com/psyc0dev/ielts_words/refs/heads/main/IELTS-4000.txt';

let cachedWords: IeltsWord[] | null = null;

export async function fetchIeltsWords(): Promise<IeltsWord[]> {
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
        // Skip malformed lines
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
    // Return fallback words as fallback
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

export async function getRandomIeltsWords(count: number): Promise<IeltsWord[]> {
  const words = await fetchIeltsWords();
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Export the words as a static array for backward compatibility
export const IELTS_WORDS: IeltsWord[] = []; // This will be populated when fetched
