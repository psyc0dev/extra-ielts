// Client for vocabulary API
export interface VocabularyWord {
  word: string;
  meaning: string;
  options: string[];
}

export interface VocabularyTestResponse {
  success: boolean;
  data: {
    words: VocabularyWord[];
    total: number;
  };
}

export interface DictionaryEntry {
  word: string;
  pos: string[];
  verbs?: DictVerb[];
  pronunciation: DictPronunciation[];
  definition: DictDefinition[];
}

interface DictVerb {
  text: string;
  tense: string;
}

interface DictPronunciation {
  pron: string;
  audio?: string;
}

interface DictDefinition {
  text: string;
  pos: string;
  source: string;
  example?: { text: string }[];
}

export interface DictionaryResponse {
  success: boolean;
  data: DictionaryEntry | null;
}

export async function getVocabularyTest(): Promise<VocabularyTestResponse> {
  try {
    const response = await fetch('/api/vocabulary/test');
    if (!response.ok) {
      throw new Error(`Failed to fetch vocabulary test: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching vocabulary test:', error);
    throw error;
  }
}

export async function getDictionaryEntry(word: string): Promise<DictionaryResponse> {
  try {
    const response = await fetch(`/api/vocabulary/dictionary/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch dictionary entry: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching dictionary entry:', error);
    throw error;
  }
}
