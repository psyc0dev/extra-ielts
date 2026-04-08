export type ApiUser = {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "student";
  avatarUrl?: string | null;
};
export type UserSettings = {
  notifications: boolean;
  sound: boolean;
  timerWarning: boolean;
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
    durationMinutes?: number;
    audioUrl?: string | null;
    passage?: string | null;
    passageTitle?: string | null;
    questions: {
      id: string;
      type: "mcq" | "short" | "true-false-notgiven" | "yes-no-notgiven" | "match-headings" | "matching" | "sentence-completion" | "note-completion" | "table-completion" | "diagram-labelling" | "form-completion" | "flowchart-completion" | "map-labelling" | "multiple-choice-multiple" | "summary-completion" | "matching-paragraph-information" | "matching-features" | "matching-sentence-endings" | "choose-title";
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
  responses: Record<string, string | null>;
  correctness?: Record<string, boolean>;
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

export type StudentStatsBucket = {
  completed: number;
  total: number;
  avgBand: number | null;
  avgReadingBand: number | null;
  avgListeningBand: number | null;
  recentAttempts: { testId: string; band: number | null; readingBand: number | null; listeningBand: number | null; completedAt: string | null }[];
};

export type StudentStats = {
  tests: StudentStatsBucket;
  homework: StudentStatsBucket;
};

import Cookies from "js-cookie";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const TOKEN_KEY = "accessToken";

function getToken() {
  return Cookies.get(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    Cookies.set(TOKEN_KEY, token, { expires: 7, path: "/", sameSite: 'strict' });
  } else {
    Cookies.remove(TOKEN_KEY, { path: "/" });
  }
}

let _isAdmin = false;
export function setIsAdmin(v: boolean) { _isAdmin = v; }
export function getIsAdmin() { return _isAdmin; }

async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const token = getToken();
  try {
    const { data } = await axios<T>(`${API_BASE}${path}`, {
      method: (options.method as string) ?? "GET",
      data: options.body,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return data;
  } catch (err) {
    const message = axios.isAxiosError(err) ? (err.response?.data?.error ?? "Request failed") : "Request failed";
    throw new Error(message);
  }
}

export async function login(payload: { identifier: string; password: string }) {
  return apiFetch<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: { username: string; email?: string; password: string }) {
  return apiFetch<{ token: string; user: ApiUser }>("/auth/register", {
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

export async function getSettings() {
  return apiFetch<{ settings: UserSettings }>("/settings");
}

export async function updateSettings(payload: Partial<UserSettings>) {
  return apiFetch<{ settings: UserSettings }>("/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
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
  return apiFetch<{ attempt: { id: string; status: string } }>(`/assignments/${assignmentId}/attempts`, {
    method: "POST",
  });
}

export async function getAttempt(attemptId: string) {
  return apiFetch<AssignmentAttemptDetail>(`/assignments/attempts/${attemptId}`);
}

export async function saveAnswer(attemptId: string, questionId: string, response: string | null) {
  return apiFetch<{ ok: boolean }>(`/assignments/attempts/${attemptId}/answers`, {
    method: "PUT",
    body: JSON.stringify({ questionId, response }),
  });
}


export async function submitAttempt(attemptId: string) {
  return apiFetch<{ attempt: { id: string; status: string; scoreTotal: number; band: number | null } }>(
    `/assignments/attempts/${attemptId}`,
    { method: "PATCH", body: JSON.stringify({ status: "completed" }) }
  );
}

/**
 * Fire-and-forget submission for unload events
 */
export function forceSubmitAttempt(attemptId: string) {
  const token = getToken();
  const url = `${API_BASE}/assignments/attempts/${attemptId}`;
  
  axios.patch(url, { status: "completed" }, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  }).catch(() => { /* ignore */ });
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

export async function adminGetTest(testId: string) {
  return apiFetch<{ test: TestDetail }>(`/admin/tests/${testId}`);
}

export async function adminUploadTest(testData: TestDetail) {
  return apiFetch<{ test: { id: string } }>("/admin/tests", {
    method: "POST",
    body: JSON.stringify({ title: testData.title, durationMinutes: testData.durationMinutes, sections: testData.sections }),
  });
}

export async function adminUpdateTest(testId: string, payload: { title?: string; durationMinutes?: number; sections?: TestDetail['sections']; published?: boolean }) {
  return apiFetch<{ ok: boolean }>(`/admin/tests/${testId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function adminToggleTestPublished(testId: string, published: boolean) {
  return apiFetch<{ ok: boolean }>(`/admin/tests/${testId}`, {
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
  return apiFetch<{ count: number }>(`/admin/groups/${groupId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordReset(email: string) {
  return apiFetch<{ ok: boolean }>('/account/password-reset-requests', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(otp: string, password: string) {
  return apiFetch<{ ok: boolean }>('/account/password', {
    method: 'PATCH',
    body: JSON.stringify({ otp, password }),
  })
}

export async function uploadAvatar(dataUrl: string) {
  return apiFetch<{ avatarUrl: string }>('/account/avatar', {
    method: 'PUT',
    body: JSON.stringify({ dataUrl }),
  })
}

export async function deleteAccount() {
  return apiFetch<{ ok: boolean }>('/account', { method: 'DELETE' })
}

export async function generateWritingTopic() {
  return apiFetch<{ topic: string; error?: string }>('/writing/topic')
}

export async function evaluateWritingEssay(payload: { topic: string; essay: string }) {
  const token = getToken();
  try {
    const { data } = await axios<{
      word_count: number
      penalty: number
      overall: number
      overall_label: string
      error?: string
      criteria: {
        task_response: { score: number; label: string; comment: string }
        coherence_and_cohesion: { score: number; label: string; comment: string }
        lexical_resource: { score: number; label: string; comment: string }
        grammatical_range_and_accuracy: { score: number; label: string; comment: string }
      }
    }>(`${API_BASE}/writing/evaluations`, {
      method: 'POST',
      data: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return data;
  } catch (err) {
    const message = axios.isAxiosError(err) ? (err.response?.data?.error ?? "Request failed") : "Request failed";
    throw new Error(message);
  }
}

export async function startTest(testId: string) {
  return apiFetch<{ attempt: { id: string; status: string }; assignmentId: string }>(`/assignments/tests/${testId}/attempts`, {
    method: "POST",
  });
}

