export type Role = 'admin' | 'student'
export type AssignmentType = 'task' | 'homework'
export type SectionKind = 'listening' | 'reading'
export type AttemptStatus = 'in-progress' | 'completed'
export type QuestionType =
  | 'mcq'
  | 'short'
  | 'essay'
  | 'fill-blank'
  | 'true-false-notgiven'
  | 'yes-no-notgiven'
  | 'match-headings'
  | 'matching'
  | 'sentence-completion'
  | 'note-completion'
  | 'table-completion'
  | 'diagram-labelling'

export type ApiUser = {
  id: string
  username: string
  email: string | null
  role: Role
}

export type UserSettings = {
  notifications: boolean
  sound: boolean
  timerWarning: boolean
}


export type TestSummary = {
  id: string
  title: string
  durationMinutes: number
  sectionsCount: number
  questionsCount: number
  published?: boolean
  attempt?: {
    id: string
    status: AttemptStatus
    scoreTotal: number | null
    band: number | null
    readingBand: number | null
    listeningBand: number | null
    startedAt: string
    completedAt: string | null
    listeningStartedAt?: string | null
    readingStartedAt?: string | null
  } | null
}

export type TestDetail = {
  id: string
  title: string
  durationMinutes: number
  published?: boolean
  sections: {
    id: string
    kind: SectionKind
    title: string
    audioUrl?: string | null
    passage?: string | null
    questions: {
      id: string
      type: QuestionType
      prompt: string
      options?: string[] | null
      items?: string[] | null
      headings?: string[] | null
      points: number
      correctAnswer?: string | string[] | null
    }[]
  }[]
}

export type AssignmentSummary = {
  id: string
  type: AssignmentType
  testId: string
  title: string
  durationMinutes: number
  dueAt: string | null
  sectionKinds: SectionKind[]
  attempt: {
    id: string
    status: AttemptStatus
    scoreTotal: number | null
    band: number | null
    readingBand: number | null
    listeningBand: number | null
    startedAt: string
    completedAt: string | null
    listeningStartedAt?: string | null
    readingStartedAt?: string | null
  } | null
}

export type AssignmentAttemptDetail = {
  assignment: {
    id: string
    type: AssignmentType
    testId: string
    title: string
    durationMinutes: number
    sectionKinds: SectionKind[]
  }
  attempt: {
    id: string
    status: AttemptStatus
    scoreTotal: number | null
    band: number | null
    readingBand: number | null
    listeningBand: number | null
    startedAt: string
    completedAt: string | null
    listeningStartedAt?: string | null
    readingStartedAt?: string | null
  }
  test: TestDetail
  responses: Record<string, unknown>
}

export type AdminAssignment = {
  id: string
  type: AssignmentType
  testId: string
  sectionKinds: SectionKind[]
  assignedTo: string
  assignedToName: string
  assignedBy: string
  assignedByName: string
  dueAt: string | null
  createdAt: string
}

export type Group = {
  id: string
  name: string
  createdAt: string
  members: { id: string; username: string; email: string | null }[]
}

export type StudentStats = {
  testsCompleted: number
  testsTotal: number
  avgBand: number | null
  avgReadingBand: number | null
  avgListeningBand: number | null
  recentAttempts: {
    testId: string
    band: number | null
    readingBand: number | null
    listeningBand: number | null
    completedAt: string | null
  }[]
}

export type User = ApiUser & {
  passwordHash: string
}

export type Assignment = {
  id: string
  type: AssignmentType
  testId: string
  sectionKinds: SectionKind[]
  assignedTo: string
  assignedBy: string
  dueAt: string | null
  createdAt: string
}

export type Attempt = {
  id: string
  assignmentId: string
  testId: string
  userId: string
  status: AttemptStatus
  scoreTotal: number | null
  band: number | null
  readingBand: number | null
  listeningBand: number | null
  startedAt: string
  completedAt: string | null
  listeningStartedAt?: string | null
  readingStartedAt?: string | null
  responses: Record<string, unknown>
}

export type StoredGroup = {
  id: string
  name: string
  createdAt: string
  members: string[]
}

export type Store = {
  users: User[]
  tests: TestDetail[]
  assignments: Assignment[]
  attempts: Attempt[]
  groups: StoredGroup[]
  settings: Record<string, UserSettings>
}

export type StoreSnapshot = {
  users: User[]
  assignments: Assignment[]
  attempts: Attempt[]
  groups: StoredGroup[]
  settings: Record<string, UserSettings>
}

export type Bindings = {
  DB?: {
    prepare: (query: string) => {
      first?: () => Promise<unknown>
    }
  }
  CORS_ORIGIN?: string
}

type AppVariables = {
  user: User
  token: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: AppVariables
}


