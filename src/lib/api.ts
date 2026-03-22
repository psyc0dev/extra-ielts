export type ApiUser = {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "student";
};

export type TestSummary = {
  id: string;
  title: string;
  durationMinutes: number;
  sectionsCount: number;
  questionsCount: number;
  published?: boolean;
  attempt?: {
    id: string;
    status: "in-progress" | "completed";
    scoreTotal: number | null;
    band: number | null;
    readingBand: number | null;
    listeningBand: number | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

export type TestDetail = {
  id: string;
  title: string;
  durationMinutes: number;
  sections: {
    id: string;
    kind: "listening" | "reading";
    title: string;
    audioUrl?: string | null;
    passage?: string | null;
    questions: {
      id: string;
      type: "mcq" | "short" | "essay" | "fill-blank" | "true-false-notgiven" | "yes-no-notgiven" | "match-headings" | "matching" | "sentence-completion" | "note-completion" | "table-completion" | "diagram-labelling";
      prompt: string;
      options?: string[] | null;
      items?: string[] | null;
      headings?: string[] | null;
      points: number;
      correctAnswer?: string | string[] | null;
    }[];
  }[];
};

export type AssignmentSummary = {
  id: string;
  type: "task" | "homework";
  testId: string;
  title: string;
  durationMinutes: number;
  dueAt: string | null;
  sectionKinds: ("listening" | "reading")[];
  attempt: {
    id: string;
    status: "in-progress" | "completed";
    scoreTotal: number | null;
    band: number | null;
    readingBand: number | null;
    listeningBand: number | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

export type AssignmentAttemptDetail = {
  assignment: {
    id: string;
    type: "task" | "homework";
    testId: string;
    title: string;
    durationMinutes: number;
    sectionKinds: ("listening" | "reading")[];
  };
  attempt: {
    id: string;
    status: "in-progress" | "completed";
    scoreTotal: number | null;
    band: number | null;
    readingBand: number | null;
    listeningBand: number | null;
    startedAt: string;
    completedAt: string | null;
  };
  test: TestDetail;
  responses: Record<string, unknown>;
};

export type AdminAssignment = {
  id: string;
  type: "task" | "homework";
  testId: string;
  sectionKinds: ("listening" | "reading")[];
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
  assignedByName: string;
  dueAt: string | null;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  createdAt: string;
  members: { id: string; username: string; email: string | null }[];
};

export type StudentStats = {
  testsCompleted: number;
  testsTotal: number;
  avgBand: number | null;
  avgReadingBand: number | null;
  avgListeningBand: number | null;
  recentAttempts: { testId: string; band: number | null; readingBand: number | null; listeningBand: number | null; completedAt: string | null }[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const TOKEN_KEY = "ielts_auth_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function getBootstrapStatus() {
  return apiFetch<{ needsBootstrap: boolean }>("/auth/bootstrap");
}

export async function bootstrapAdmin(payload: { username: string; email?: string; password: string }) {
  return apiFetch<{ token: string; user: ApiUser }>("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: { identifier: string; password: string }) {
  return apiFetch<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function getMe() {
  return apiFetch<{ user: ApiUser }>("/auth/me");
}

export async function listTests() {
  return apiFetch<{ tests: TestSummary[] }>("/tests");
}

export async function getTest(testId: string) {
  return apiFetch<{ test: TestDetail }>(`/tests/${testId}`);
}

export async function listAssignments(type: "task" | "homework") {
  return apiFetch<{ assignments: AssignmentSummary[] }>(`/assignments?type=${type}`);
}

export async function startAssignment(assignmentId: string) {
  return apiFetch<{ attempt: { id: string; status: string } }>(`/assignments/${assignmentId}/start`, {
    method: "POST",
  });
}

export async function getAttempt(attemptId: string) {
  return apiFetch<AssignmentAttemptDetail>(`/assignments/attempts/${attemptId}`);
}

export async function saveAnswer(attemptId: string, questionId: string, response: unknown) {
  return apiFetch<{ ok: boolean }>(`/assignments/attempts/${attemptId}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, response }),
  });
}

export async function submitAttempt(attemptId: string) {
  return apiFetch<{ attempt: { id: string; status: string; scoreTotal: number; band: number | null } }>(
    `/assignments/attempts/${attemptId}/submit`,
    { method: "POST" }
  );
}

export async function adminListUsers() {
  return apiFetch<{ users: ApiUser[] }>("/admin/users");
}

export async function adminCreateUser(payload: { username: string; email?: string; password: string; role: "admin" | "student" }) {
  return apiFetch<{ user: ApiUser }>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminListTests() {
  return apiFetch<{ tests: TestSummary[] }>("/admin/tests");
}

export async function adminListAssignments(type: "task" | "homework") {
  return apiFetch<{ assignments: AdminAssignment[] }>(`/admin/assignments?type=${type}`);
}

export async function adminCreateAssignment(payload: {
  type: "task" | "homework";
  testId: string;
  sectionKinds: ("listening" | "reading")[];
  assignedTo: string;
  dueAt?: string | null;
}) {
  return apiFetch<{ assignment: { id: string } }>("/admin/assignments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminToggleTestPublished(testId: string, published: boolean) {
  return apiFetch<{ ok: boolean }>(`/admin/tests/${testId}/published`, {
    method: "PATCH",
    body: JSON.stringify({ published }),
  });
}

export async function adminListGroups() {
  return apiFetch<{ groups: Group[] }>("/admin/groups");
}

export async function adminGetStudentStats(userId: string) {
  return apiFetch<{ stats: StudentStats }>(`/admin/users/${userId}/stats`);
}

export async function adminCreateGroup(name: string) {
  return apiFetch<{ group: { id: string; name: string } }>("/admin/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function adminDeleteGroup(groupId: string) {
  return apiFetch<{ ok: boolean }>(`/admin/groups/${groupId}`, { method: "DELETE" });
}

export async function adminAddGroupMember(groupId: string, userId: string) {
  return apiFetch<{ ok: boolean }>(`/admin/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function adminRemoveGroupMember(groupId: string, userId: string) {
  return apiFetch<{ ok: boolean }>(`/admin/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}

export async function adminAssignToGroup(groupId: string, payload: { type: "task" | "homework"; testId: string; sectionKinds: ("listening" | "reading")[]; dueAt?: string | null }) {
  return apiFetch<{ count: number }>(`/admin/groups/${groupId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startTest(testId: string) {
  return apiFetch<{ attempt: { id: string; status: string }; assignmentId: string }>(`/assignments/tests/${testId}/start`, {
    method: "POST",
  });
}
