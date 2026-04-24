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

interface DictVerb {
  text: string;
  tense: string;
}

interface DictPronunciation {
  pron: string;
  audio?: string;
}

export interface DictDefinition {
  text: string;
  pos: string;
  source: string;
  example?: { text: string }[];
}

export interface DictionaryEntry {
  word: string;
  pos: string[];
  verbs?: DictVerb[];
  pronunciation: DictPronunciation[];
  definition: DictDefinition[];
}

export interface DictionaryResponse {
  success: boolean;
  data: DictionaryEntry | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getVocabularyTest(): Promise<VocabularyTestResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/vocabulary/test`);
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
    const response = await fetch(`${API_BASE_URL}/vocabulary/dictionary/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch dictionary entry: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching dictionary entry:', error);
    throw error;
  }
}
