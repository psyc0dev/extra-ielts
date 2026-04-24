// English translations for the vocabulary test application
export const en = {
  // Vocabulary page
  vocabulary: {
    title: 'Vocabulary Trainer',
    subtitle: 'Pick the correct definition — unlimited rounds, no repetition within a round.',
    progress: 'Progress',
    round: 'Round',
    correct: 'correct',
    wrong: 'wrong',
    speak: 'Speak',
    continue: 'Continue',
    reset: 'Reset',
    
    // Dictionary section
    noDictionaryEntry: 'No dictionary entry found.',
    partsOfSpeech: 'Parts of speech:',
    verbForms: 'Verb forms:',
    examples: 'Examples:',
    
    // Toast messages
    pronunciationError: 'Could not play pronunciation.',
    loading: 'Loading vocabulary tests...',
    testCompleted: 'Test completed! Starting new test...',
    failedToLoad: 'Failed to load vocabulary test',
    failedToReset: 'Failed to reset vocabulary test',
  },
  
  // General UI
  ui: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  }
};

export type Translations = typeof en;
