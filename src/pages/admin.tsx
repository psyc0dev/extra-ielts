import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Calendar } from "@/components/ui/calendar";
import { open } from "@tauri-apps/plugin-shell";
import {
  adminCreateAssignment,
  adminCreateUser,
  adminListAssignments,
  adminListTests,
  adminListUsers,
  adminToggleTestPublished,
  adminListGroups,
  adminCreateGroup,
  adminDeleteGroup,
  adminAddGroupMember,
  adminRemoveGroupMember,
  adminAssignToGroup,
  adminGetStudentStats,
  adminUploadTest,
  getToken,
  type AdminAssignment,
  type ApiUser,
  type TestSummary,
  type TestDetail,
  type Group,
  type StudentStats,
} from "@/lib/api";
import {
  toast
} from "sonner";
import {
  Plus,
  Trash,
  UserMinus,
  Users,
  Trophy,
  Headphones,
  BookOpen as BookOpenIcon,
  Gauge,
  ClipboardText,
  UsersThree,
  CaretDown
} from "@phosphor-icons/react";
import en from "@/locales/en";
import { invoke } from "@tauri-apps/api/core";

type AdminSection = "overview" | "users" | "tests" | "assignments" | "groups" | "user-details" | "group-details";

export function Admin() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState<AdminAssignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const sk = useDelayedLoading(loading);
  const [section, setSection] = useState<AdminSection>("overview");
  const [userQuery, setUserQuery] = useState("");
  const [testQuery, setTestQuery] = useState("");
  const [assignmentQuery, setAssignmentQuery] = useState("");
  const [groupQuery, setGroupQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);


  const loadAll = useCallback(async () => {
    const [usersRes, testsRes, homeworkRes, groupsRes] = await Promise.all([
      adminListUsers(),
      adminListTests(),
      adminListAssignments("homework"),
      adminListGroups(),
    ]);
    setUsers(usersRes.users);
    setTests(testsRes.tests);
    setHomeworkAssignments(homeworkRes.assignments);
    setGroups(groupsRes.groups);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll().catch((err) => toast.error(err.message));
  }, [loadAll]);

  const testMap = useMemo(
    () => new Map(tests.map((test) => [test.id, test.title])),
    [tests]
  );

  const visibleUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.username, u.email, u.role].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [users, userQuery]);

  const visibleTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => t.title.toLowerCase().includes(q));
  }, [tests, testQuery]);

  const visibleAssignments = useMemo(() => {
    const q = assignmentQuery.trim().toLowerCase();
    if (!q) return homeworkAssignments;
    return homeworkAssignments.filter((a) => {
      const title = testMap.get(a.testId) ?? a.testId;
      return `${title} ${a.assignedToName}`.toLowerCase().includes(q);
    });
  }, [homeworkAssignments, assignmentQuery, testMap]);

  const visibleGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, groupQuery]);

  const togglePublished = useCallback(async (testId: string, published: boolean) => {
    try {
      await adminToggleTestPublished(testId, published);
      setTests((prev) => prev.map((t) => t.id === testId ? { ...t, published } : t));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.admin.errors.updateFailed);
    }
  }, []);

  const handleDownloadTest = useCallback(async (test: TestSummary) => {
    try {
      const token = getToken();
      if (!token) {
        toast.error("Missing auth token.");
        return;
      }
      const base = import.meta.env.VITE_API_BASE_URL;
      const url = `${base}/admin/tests/${test.id}/download?token=${encodeURIComponent(token)}`;
      const isTauri = typeof window !== "undefined" && Boolean((window as typeof window & { __TAURI__?: unknown }).__TAURI__);
      if (isTauri) {
        await open(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to download test.");
    }
  }, []);

  const navItems: { id: AdminSection; label: string; description: string; icon: ReactNode }[] = [
    { id: "overview", label: en.admin.sections.overview, description: en.admin.sections.overviewSub, icon: <Gauge weight="bold" className="size-4" /> },
    { id: "users", label: en.admin.sections.users, description: en.admin.sections.usersSub, icon: <UsersThree weight="bold" className="size-4" /> },
    { id: "tests", label: en.admin.sections.tests, description: en.admin.sections.testsSub, icon: <BookOpenIcon weight="bold" className="size-4" /> },
    { id: "assignments", label: en.admin.sections.assignments, description: en.admin.sections.assignmentsSub, icon: <ClipboardText weight="bold" className="size-4" /> },
    { id: "groups", label: en.admin.sections.groups, description: en.admin.sections.groupsSub, icon: <Users weight="bold" className="size-4" /> },
  ];

  const activeNavId = section;

  return (
    <div className="p-4 md:p-6 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 h-full">
        <motion.aside
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0, ease: 'easeOut' }}
          className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4 flex flex-col gap-4">
          <div>
            <div className="text-xs text-muted-foreground">{en.admin.panel.badge}</div>
            <div className="text-base font-semibold">{en.admin.panel.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{en.admin.panel.subtitle}</div>
          </div>
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  activeNavId === item.id
                    ? "border-emerald-700/60 bg-emerald-900/20 text-white"
                    : "border-neutral-800 hover:bg-neutral-900/60 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {item.icon}
                  {item.label}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{item.description}</div>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-muted-foreground">
            {en.admin.panel.note}
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.06, ease: 'easeOut' }}
          className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{en.admin.title}</div>
              <div className="text-xs text-muted-foreground">{en.admin.subtitle}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {section === "tests" && (
                <div className="flex items-center gap-2">
                  <UploadTestButton
                    onUpload={async (testData) => {
                      const res = await adminUploadTest(testData);
                      setTests((prev) => [
                        { id: res.test.id, title: testData.title, durationMinutes: testData.durationMinutes, sectionsCount: testData.sections.length, questionsCount: testData.sections.reduce((n, s) => n + s.questions.length, 0), published: false },
                        ...prev,
                      ]);
                      toast.success("Test uploaded");
                    }}
                  />
                </div>
              )}
              {section === "users" && (
                <CreateUserDialog
                  onCreate={async (payload) => {
                    const res = await adminCreateUser(payload);
                    setUsers((prev) => [res.user, ...prev]);
                  }}
                />
              )}
              {section === "assignments" && (
                <CreateAssignmentDialog
                  tests={tests}
                  users={users}
                  groups={groups}
                  type="homework"
                  onCreate={async (payload) => {
                    const res = await adminCreateAssignment({
                      ...payload,
                      dueAt: payload.dueAt ? new Date(payload.dueAt).toISOString() : null,
                    });
                    toast.success(en.admin.toasts.assignmentCreated);
                    setHomeworkAssignments((prev) => [
                      {
                        id: res.assignment.id,
                        type: "homework",
                        testId: payload.testId,
                        sectionKinds: payload.sectionKinds,
                        assignedTo: payload.assignedTo,
                        assignedToName: users.find((u) => u.id === payload.assignedTo)?.username ?? "",
                        assignedBy: "",
                        assignedByName: "",
                        dueAt: payload.dueAt ?? null,
                        createdAt: new Date().toISOString(),
                      },
                      ...prev,
                    ]);
                  }}
                />
              )}
              {section === "groups" && (
                <CreateGroupDialog
                  onCreate={async (name) => {
                    const res = await adminCreateGroup(name);
                    setGroups((prev) => [
                      { id: res.group.id, name: res.group.name, createdAt: new Date().toISOString(), members: [] },
                      ...prev,
                    ]);
                    toast.success(en.admin.groups.created);
                  }}
                />
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="flex flex-col gap-4"
            >
          {section === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {sk ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="border-neutral-800 bg-neutral-950/50">
                    <CardHeader className="pb-2"><Skeleton className="h-3 w-20" /></CardHeader>
                    <CardContent><Skeleton className="h-8 w-12" /></CardContent>
                  </Card>
                ))
              ) : (<>
              <Card className="border-neutral-800 bg-neutral-950/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold">{en.admin.overview.users}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{users.length}</CardContent>
              </Card>
              <Card className="border-neutral-800 bg-neutral-950/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold">{en.admin.overview.tests}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{tests.length}</CardContent>
              </Card>
              <Card className="border-neutral-800 bg-neutral-950/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold">{en.admin.overview.assignments}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{homeworkAssignments.length}</CardContent>
              </Card>
              <Card className="border-neutral-800 bg-neutral-950/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold">{en.admin.overview.groups}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{groups.length}</CardContent>
              </Card>
              </>)}
            </div>
          )}

          {section === "users" && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-xs font-semibold">{en.admin.users.title}</CardTitle>
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder={en.admin.users.search}
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{en.admin.users.table.username}</TableHead>
                      <TableHead>{en.admin.users.table.email}</TableHead>
                      <TableHead>{en.admin.users.table.role}</TableHead>
                      <TableHead className="text-right">{en.admin.groupDetails.tableHeaders.action}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sk ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>)}
                      </TableRow>
                    )) : visibleUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">{en.admin.users.notFound}</TableCell></TableRow>
                    ) : visibleUsers.map((user) => (
                      <UserRow key={user.id} user={user} onView={(target) => { setSelectedUser(target); setSection("user-details"); }} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {section === "tests" && (
            <>
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-xs font-semibold">{en.admin.tests.title}</CardTitle>
                <Input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder={en.admin.tests.search}
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{en.admin.tests.table.title}</TableHead>
                      <TableHead>{en.admin.tests.table.duration}</TableHead>
                      <TableHead>{en.admin.tests.table.sections}</TableHead>
                      <TableHead>{en.admin.tests.table.status}</TableHead>
                      <TableHead>{en.admin.tests.table.published}</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sk ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>)}
                      </TableRow>
                    )) : visibleTests.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">{en.admin.tests.notFound}</TableCell></TableRow>
                    ) : visibleTests.map((test) => (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium">{test.title}</TableCell>
                        <TableCell className="text-muted-foreground">{test.durationMinutes} {en.admin.tests.minutesSuffix}</TableCell>
                        <TableCell className="text-muted-foreground">{test.sectionsCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={test.published
                              ? "border-emerald-800 text-emerald-400"
                              : "border-neutral-700 text-muted-foreground"}
                          >
                            {test.published ? en.admin.tests.status.published : en.admin.tests.status.draft}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={test.published ?? false}
                            onCheckedChange={(checked) => togglePublished(test.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-700" onClick={() => handleDownloadTest(test)}>
                            Download JSON
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </>
          )}

          {section === "assignments" && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-xs font-semibold">{en.admin.assignments.title}</CardTitle>
                <Input
                  value={assignmentQuery}
                  onChange={(e) => setAssignmentQuery(e.target.value)}
                  placeholder={en.admin.assignments.search}
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{en.admin.assignments.table.test}</TableHead>
                      <TableHead>{en.admin.assignments.table.sections}</TableHead>
                      <TableHead>{en.admin.assignments.table.assignedTo}</TableHead>
                      <TableHead>{en.admin.assignments.table.due}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sk ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>)}
                      </TableRow>
                    )) : visibleAssignments.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">{en.admin.assignments.notFound}</TableCell></TableRow>
                    ) : visibleAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{testMap.get(assignment.testId) ?? assignment.testId}</TableCell>
                        <TableCell className="capitalize">{assignment.sectionKinds.join(", ")}</TableCell>
                        <TableCell>{assignment.assignedToName}</TableCell>
                        <TableCell className="text-muted-foreground">{assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : en.common.na}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {section === "groups" && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-xs font-semibold">{en.admin.groups.title}</CardTitle>
                <Input
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  placeholder={en.admin.groups.search}
                  className="max-w-xs"
                />
              </CardHeader>
              <CardContent>
                <GroupsPanel
                  groups={visibleGroups}
                  users={users}
                  tests={tests}
                  onViewGroup={(group) => {
                    setSelectedGroup(group);
                    setSection("group-details");
                  }}
                  onGroupCreated={(g) => setGroups((prev) => [g, ...prev])}
                  onGroupDeleted={(id) => setGroups((prev) => prev.filter((g) => g.id !== id))}
                  onMemberAdded={(groupId, user) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: [...g.members, user] } : g))}
                  onMemberRemoved={(groupId, userId) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: g.members.filter((m) => m.id !== userId) } : g))}
                />
              </CardContent>
            </Card>
          )}

          {section === "user-details" && selectedUser && (
            <UserDetailsPage
              user={selectedUser}
              testMap={testMap}
              onBack={() => {
                setSection("users");
                setSelectedUser(null);
              }}
            />
          )}

          {section === "group-details" && selectedGroup && (
            <GroupDetailsPage
              group={selectedGroup}
              onBack={() => {
                setSection("groups");
                setSelectedGroup(null);
              }}
              onViewUser={(userId) => {
                const user = users.find((u) => u.id === userId);
                if (!user) return;
                setSelectedUser(user);
                setSection("user-details");
              }}
            />
          )}

            </motion.div>
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
  );
}

function UserRow({ user, onView }: { user: ApiUser; onView: (user: ApiUser) => void }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{user.username}</TableCell>
      <TableCell className="text-muted-foreground">{user.email ?? en.common.na}</TableCell>
      <TableCell className="capitalize">{user.role}</TableCell>
      <TableCell className="text-right">
        {user.role === "student" ? (
          <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-700" onClick={() => onView(user)}>
            {en.admin.users.viewStats}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{en.common.na}</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function StatChip({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-bold flex items-center gap-1">{icon}{value}</span>
    </div>
  );
}

function buildDueAt(dueDate?: Date, dueTime?: string) {
  if (!dueDate || !dueTime) return null;
  const yyyy = dueDate.getFullYear();
  const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
  const dd = String(dueDate.getDate()).padStart(2, "0");
  const local = `${yyyy}-${mm}-${dd}T${dueTime}:00`;
  return new Date(local).toISOString();
}

function formatDateLabel(date?: Date) {
  return date ? date.toLocaleDateString() : en.admin.assignments.pickDate;
}

function UserDetailsPage({
  user,
  testMap,
  onBack,
}: {
  user: ApiUser;
  testMap: Map<string, string>;
  onBack: () => void;
}) {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (user.role !== "student") {
      setLoading(false);
      return;
    }
    adminGetStudentStats(user.id)
      .then((res) => {
        if (mounted) setStats(res.stats);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [user]);

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xs font-semibold">{en.admin.userDetails.title}</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">{user.username} � {user.email ?? en.common.na}</div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBack}>
          {en.admin.userDetails.backButton}
        </Button>
      </CardHeader>
      <CardContent>
        {user.role !== "student" && (
          <div className="text-xs text-muted-foreground">{en.admin.userDetails.noStatsForAdmin}</div>
        )}
        {user.role === "student" && loading && (
          <div className="flex flex-col gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-2.5 w-20" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <Skeleton className="h-2 w-16" />
                      <Skeleton className="h-4 w-10 mt-0.5" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
                      <Skeleton className="h-3 w-32" />
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {user.role === "student" && !loading && stats && (
          <div className="flex flex-col gap-5">
            {([
              { label: en.admin.sections.tests, data: stats.tests },
              { label: en.admin.sections.assignments, data: stats.homework },
            ]).map(({ label, data }) => (
              <div key={label} className="flex flex-col gap-3">
                <span className="text-[10px] text-muted-foreground font-medium uppercase">{label}</span>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <StatChip label={en.admin.stats.testsDone} value={`${data.completed}/${data.total}`} />
                  <StatChip label={en.admin.stats.avgBand} value={data.avgBand ?? en.common.na} icon={<Trophy weight="bold" className="size-3 text-amber-400" />} />
                  <StatChip label={en.admin.stats.listening} value={data.avgListeningBand ?? en.common.na} icon={<Headphones weight="bold" className="size-3 text-sky-400" />} />
                  <StatChip label={en.admin.stats.reading} value={data.avgReadingBand ?? en.common.na} icon={<BookOpenIcon weight="bold" className="size-3 text-violet-400" />} />
                </div>
                {data.recentAttempts.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">{en.admin.stats.recent}</span>
                    <div className="flex flex-col gap-2">
                      {data.recentAttempts.map((a, i) => (
                        <div key={`${label}-${i}`} className="flex flex-col gap-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs md:flex-row md:items-center md:justify-between">
                          <span className="text-muted-foreground">{testMap.get(a.testId) ?? a.testId}</span>
                          <div className="flex items-center gap-3">
                            {a.listeningBand != null && <span className="flex items-center gap-0.5 text-sky-400"><Headphones weight="bold" className="size-3" />{a.listeningBand}</span>}
                            {a.readingBand != null && <span className="flex items-center gap-0.5 text-violet-400"><BookOpenIcon weight="bold" className="size-3" />{a.readingBand}</span>}
                            {a.band != null && <span className="flex items-center gap-0.5 font-semibold"><Trophy weight="bold" className="size-3 text-amber-400" />{a.band}</span>}
                            <span className="text-muted-foreground text-[10px]">{a.completedAt ? new Date(a.completedAt).toLocaleDateString() : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{en.admin.stats.noData}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {user.role === "student" && !loading && !stats && (
          <div className="text-xs text-muted-foreground">{en.admin.stats.noData}</div>
        )}
      </CardContent>
    </Card>
  );
}

function GroupDetailsPage({
  group,
  onBack,
  onViewUser,
}: {
  group: Group;
  onBack: () => void;
  onViewUser: (userId: string) => void;
}) {
  const [statsByUser, setStatsByUser] = useState<Record<string, StudentStats | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (group.members.length === 0) return;
    setLoading(true);
    Promise.all(
      group.members.map((member) =>
        adminGetStudentStats(member.id)
          .then((res) => [member.id, res.stats] as const)
          .catch(() => [member.id, null] as const)
      )
    )
      .then((rows) => {
        if (!mounted) return;
        const next: Record<string, StudentStats | null> = {};
        rows.forEach(([id, stats]) => { next[id] = stats; });
        setStatsByUser(next);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [group]);

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xs font-semibold">{en.admin.groupDetails.title}</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">{en.admin.groupDetails.membersCount(group.name, group.members.length)}</div>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBack}>
          {en.admin.groupDetails.backButton}
        </Button>
      </CardHeader>
      <CardContent>
        {group.members.length === 0 ? (
          <div className="text-xs text-muted-foreground">{en.admin.groupDetails.noMembers}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{en.admin.groupDetails.tableHeaders.student}</TableHead>
                <TableHead>{en.admin.groupDetails.tableHeaders.testsDone}</TableHead>
                <TableHead>{en.admin.groupDetails.tableHeaders.testsAvgBand}</TableHead>
                <TableHead>{en.admin.groupDetails.tableHeaders.assignmentsDone}</TableHead>
                <TableHead>{en.admin.groupDetails.tableHeaders.assignmentsAvgBand}</TableHead>
                <TableHead className="text-right">{en.admin.groupDetails.tableHeaders.action}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.members.map((member) => {
                const stats = statsByUser[member.id];
                const testsDone = stats ? `${stats.tests.completed}/${stats.tests.total}` : en.common.na;
                const testsAvg = stats?.tests.avgBand ?? en.common.na;
                const assignmentsDone = stats ? `${stats.homework.completed}/${stats.homework.total}` : en.common.na;
                const assignmentsAvg = stats?.homework.avgBand ?? en.common.na;
                return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.username}</TableCell>
                  <TableCell className="text-muted-foreground">{loading ? <Skeleton className="h-3 w-10" /> : testsDone}</TableCell>
                  <TableCell>{loading ? <Skeleton className="h-3 w-8" /> : testsAvg}</TableCell>
                  <TableCell>{loading ? <Skeleton className="h-3 w-10" /> : assignmentsDone}</TableCell>
                  <TableCell>{loading ? <Skeleton className="h-3 w-8" /> : assignmentsAvg}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-700" onClick={() => onViewUser(member.id)}>
                      {en.admin.users.viewStats}
                    </Button>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AssignmentPanel({
  title,
  assignments,
  tests,
  users,
  groups,
  testMap,
  type,
  onCreated,
}: {
  title: string;
  assignments: AdminAssignment[];
  tests: TestSummary[];
  users: ApiUser[];
  groups: Group[];
  testMap: Map<string, string>;
  type: "task" | "homework";
  onCreated: (assignment: AdminAssignment) => void;
}) {
  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold">{title}</CardTitle>
        <CreateAssignmentDialog
          tests={tests}
          users={users}
          groups={groups}
          type={type}
          onCreate={async (payload) => {
            const res = await adminCreateAssignment({
              ...payload,
              dueAt: payload.dueAt ? new Date(payload.dueAt).toISOString() : null,
            });
            toast.success(en.admin.toasts.assignmentCreated);
            onCreated({
              id: res.assignment.id,
              type,
              testId: payload.testId,
              sectionKinds: payload.sectionKinds,
              assignedTo: payload.assignedTo,
              assignedToName: users.find((u) => u.id === payload.assignedTo)?.username ?? "",
              assignedBy: "",
              assignedByName: "",
              dueAt: payload.dueAt ?? null,
              createdAt: new Date().toISOString(),
            });
          }}
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{en.admin.assignments.table.test}</TableHead>
              <TableHead>{en.admin.assignments.table.sections}</TableHead>
              <TableHead>{en.admin.assignments.table.assignedTo}</TableHead>
              <TableHead>{en.admin.assignments.table.due}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell>{testMap.get(assignment.testId) ?? assignment.testId}</TableCell>
                <TableCell className="capitalize">{assignment.sectionKinds.join(", ")}</TableCell>
                <TableCell>{assignment.assignedToName}</TableCell>
                <TableCell className="text-muted-foreground">{assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : en.common.na}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({ onCreate }: { onCreate: (payload: { username: string; email?: string; password: string; role: "admin" | "student" }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "student">("student");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus weight="bold" className="size-3" /> {en.admin.users.new}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">{en.admin.users.dialog.title}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{en.admin.users.dialog.username}</FieldLabel>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={en.login.placeholders.username} />
          </Field>
          <Field>
            <FieldLabel>{en.admin.users.dialog.email}</FieldLabel>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={en.admin.users.dialog.emailPlaceholder} />
          </Field>
          <Field>
            <FieldLabel>{en.admin.users.dialog.password}</FieldLabel>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder={en.login.placeholders.password} />
          </Field>
          <Field>
            <FieldLabel>{en.admin.users.dialog.role}</FieldLabel>
            <Select value={role} onValueChange={(value) => setRole(value as "admin" | "student")}>
              <SelectTrigger>
                <SelectValue placeholder={en.admin.users.dialog.role} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">{en.admin.users.dialog.roleStudent}</SelectItem>
                <SelectItem value="admin">{en.admin.users.dialog.roleAdmin}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={async () => {
              await onCreate({ username, email: email || undefined, password, role });
              toast.success(en.admin.toasts.userCreated);
              setOpen(false);
            }}
          >
            {en.admin.users.dialog.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAssignmentDialog({
  tests,
  users,
  groups,
  type,
  onCreate,
}: {
  tests: TestSummary[];
  users: ApiUser[];
  groups: Group[];
  type: "task" | "homework";
  onCreate: (payload: { type: "task" | "homework"; testId: string; sectionKinds: ("listening" | "reading")[]; assignedTo: string; dueAt?: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [testId, setTestId] = useState("");
  const [assignMode, setAssignMode] = useState<"student" | "group">("student");
  const [assignedTo, setAssignedTo] = useState("");
  const [sectionKinds, setSectionKinds] = useState<("listening" | "reading")[]>(["listening", "reading"]);
  const [dueDate, setDueDate] = useState<Date>();
  const [dueTime, setDueTime] = useState("23:59");
  const students = users.filter((user) => user.role === "student");

  const handleCreate = async () => {
    const dueAt = buildDueAt(dueDate, dueTime);
    if (assignMode === "group") {
      const res = await adminAssignToGroup(assignedTo, { type, testId, sectionKinds, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
      toast.success(en.admin.toasts.assignedToCount(res.count));
      setOpen(false);
    } else {
      await onCreate({ type, testId, sectionKinds, assignedTo, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus weight="bold" className="size-3" /> {en.admin.assignments.new}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">{en.admin.assignments.createTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{en.admin.assignments.test}</FieldLabel>
            <Select value={testId} onValueChange={setTestId}>
              <SelectTrigger>
                <SelectValue placeholder={en.admin.assignments.selectTest} />
              </SelectTrigger>
              <SelectContent>
                {tests.map((test) => (
                  <SelectItem key={test.id} value={test.id}>{test.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{en.admin.assignments.sections}</FieldLabel>
            <Select
              value={sectionKinds.join(",")}
              onValueChange={(value) => setSectionKinds(value.split(",") as ("listening" | "reading")[])}
            >
              <SelectTrigger>
                <SelectValue placeholder={en.admin.assignments.selectSections} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listening">{en.admin.assignments.listening}</SelectItem>
                <SelectItem value="reading">{en.admin.assignments.reading}</SelectItem>
                <SelectItem value="listening,reading">{en.admin.assignments.listeningReading}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{en.admin.assignments.assignTo}</FieldLabel>
            <Tabs value={assignMode} onValueChange={(v) => { setAssignMode(v as "student" | "group"); setAssignedTo(""); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="student">{en.admin.assignTo.student}</TabsTrigger>
                <TabsTrigger value="group">{en.admin.assignTo.group}</TabsTrigger>
              </TabsList>
              <TabsContent value="student" className="mt-0">
                <AssignToSelect students={students} value={assignedTo} onChange={setAssignedTo} />
              </TabsContent>
              <TabsContent value="group" className="mt-0">
                <AssignToGroupSelect groups={groups} value={assignedTo} onChange={setAssignedTo} />
              </TabsContent>
            </Tabs>
          </Field>
          <Field>
            <FieldLabel>{en.admin.assignments.due}</FieldLabel>
            <div className="flex flex-col gap-2 md:flex-row md:items-start">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-between border-neutral-700 bg-neutral-900 font-normal text-xs">
                    {formatDateLabel(dueDate)}
                    <CaretDown className="size-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 border-neutral-700 bg-neutral-900" align="start">
                  <div className="w-full">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} captionLayout="label" className="w-full [--cell-size:1.5rem]" />
                  </div>
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-28"
              />
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!testId || !assignedTo || sectionKinds.length === 0}
          >
            {en.admin.assignments.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignToGroupSelect({ groups, value, onChange }: { groups: Group[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = groups.find((g) => g.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal border-neutral-700 bg-neutral-900">
          {selected ? selected.name : en.admin.assignTo.selectGroup}
          <CaretDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-neutral-700 bg-neutral-900" align="start">
        <Command className="bg-neutral-900">
          <CommandInput placeholder={en.admin.assignTo.searchGroup} className="h-8 text-xs" />
          <CommandList className="max-h-60">
            <CommandEmpty className="text-xs py-3 text-center px-2">{en.admin.assignTo.noGroup}</CommandEmpty>
            <CommandGroup>
              {groups.map((g) => (
                <CommandItem key={g.id} value={g.name} className="text-xs flex items-center justify-between" onSelect={() => { onChange(g.id); setOpen(false); }}>
                  <span>{g.name}</span>
                  <span className="text-muted-foreground">({g.members.length})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AssignToSelect({ students, value, onChange }: { students: ApiUser[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = students.find((s) => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal border-neutral-700 bg-neutral-900">
          {selected ? selected.username : en.admin.assignTo.selectStudent}
          <CaretDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-neutral-700 bg-neutral-900" align="start">
        <Command className="bg-neutral-900">
          <CommandInput placeholder={en.admin.assignTo.searchStudent} className="h-8 text-xs" />
          <CommandList className="max-h-60">
            <CommandEmpty className="text-xs py-3 text-center px-2">{en.admin.assignTo.noStudent}</CommandEmpty>
            <CommandGroup>
              {students.map((s) => (
                <CommandItem key={s.id} value={s.username} className="text-xs" onSelect={() => { onChange(s.id); setOpen(false); }}>
                  {s.username}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function GroupsPanel({
  groups,
  users,
  tests,
  onViewGroup,
  onGroupCreated,
  onGroupDeleted,
  onMemberAdded,
  onMemberRemoved,
}: {
  groups: Group[];
  users: ApiUser[];
  tests: TestSummary[];
  onViewGroup: (group: Group) => void;
  onGroupCreated: (g: Group) => void;
  onGroupDeleted: (id: string) => void;
  onMemberAdded: (groupId: string, user: { id: string; username: string; email: string | null }) => void;
  onMemberRemoved: (groupId: string, userId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{en.admin.groups.members(groups.length)}</span>
        <CreateGroupDialog
          onCreate={async (name) => {
            const res = await adminCreateGroup(name);
            onGroupCreated({ id: res.group.id, name: res.group.name, createdAt: new Date().toISOString(), members: [] });
            toast.success(en.admin.groups.created);
          }}
        />
      </div>
      {groups.length === 0 ? (
        <Card className="border-neutral-800 bg-neutral-900">
          <CardContent className="px-4 py-8 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-6 mb-1" />
            {en.admin.groups.empty}
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            users={users}
            tests={tests}
            onView={() => onViewGroup(group)}
            onDelete={async () => {
              await adminDeleteGroup(group.id);
              onGroupDeleted(group.id);
              toast.success(en.admin.groups.delete);
            }}
            onAddMember={async (userId) => {
              await adminAddGroupMember(group.id, userId);
              const user = users.find((u) => u.id === userId)!;
              onMemberAdded(group.id, { id: user.id, username: user.username, email: user.email ?? null });
            }}
            onRemoveMember={async (userId) => {
              await adminRemoveGroupMember(group.id, userId);
              onMemberRemoved(group.id, userId);
            }}
          />
        ))
      )}
    </div>
  );
}

function GroupCard({
  group,
  users,
  tests,
  onView,
  onDelete,
  onAddMember,
  onRemoveMember,
}: {
  group: Group;
  users: ApiUser[];
  tests: TestSummary[];
  onView: () => void;
  onDelete: () => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}) {
  const nonMembers = users.filter((u) => u.role === "student" && !group.members.some((m) => m.id === u.id));

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Users weight="bold" className="size-3.5 text-muted-foreground" />
          <CardTitle className="text-xs font-semibold">{group.name}</CardTitle>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-neutral-700 text-muted-foreground">
            {en.admin.groups.members(group.members.length)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <AssignGroupHomeworkDialog group={group} tests={tests} />
          <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-700" onClick={onView}>
            {en.admin.groupDetails.viewDetails}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/30"
            onClick={onDelete}
          >
            <Trash weight="bold" className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {group.members.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {group.members.map((m) => (
              <span key={m.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-800 text-white">
                {m.username}
                <button onClick={() => onRemoveMember(m.id)} className="text-neutral-500 hover:text-red-400 transition-colors">
                  <UserMinus weight="bold" className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {nonMembers.length > 0 && (
          <AddMemberSelect nonMembers={nonMembers} onAdd={onAddMember} />
        )}
      </CardContent>
    </Card>
  );
}

function AddMemberSelect({ nonMembers, onAdd }: { nonMembers: ApiUser[]; onAdd: (userId: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs border-neutral-700 bg-neutral-800 w-56 justify-start font-normal">
          <Plus weight="bold" className="size-3 mr-1 shrink-0" /> {en.admin.groups.addStudent}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 border-neutral-700 bg-neutral-900" align="start">
        <Command className="bg-neutral-900">
          <CommandInput placeholder={en.admin.groups.search} className="h-7 py-1 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="text-xs py-3 text-center px-2">{en.admin.groups.noStudents}</CommandEmpty>
            <CommandGroup>
              {nonMembers.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.username}
                  className="text-xs"
                  onSelect={async () => { setOpen(false); await onAdd(u.id); }}
                >
                  {u.username}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CreateGroupDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus weight="bold" className="size-3" /> {en.admin.groups.new}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">{en.admin.groups.createTitle}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel>{en.admin.groups.groupName}</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={en.admin.groups.groupNamePlaceholder} />
        </Field>
        <DialogFooter>
          <Button disabled={!name.trim()} onClick={async () => { await onCreate(name.trim()); setName(""); setOpen(false); }}>
            {en.admin.groups.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignGroupHomeworkDialog({ group, tests }: { group: Group; tests: TestSummary[] }) {
  const [open, setOpen] = useState(false);
  const [testId, setTestId] = useState("");
  const [sectionKinds, setSectionKinds] = useState<("listening" | "reading")[]>(["listening", "reading"]);
  const [dueDate, setDueDate] = useState<Date>();
  const [dueTime, setDueTime] = useState("23:59");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700">
          <Plus weight="bold" className="size-3" /> {en.admin.groups.assignHomework}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">{en.admin.groups.assignTitle(group.name)}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{en.admin.assignments.test}</FieldLabel>
            <TestSelect tests={tests} value={testId} onChange={setTestId} />
          </Field>
          <Field>
            <FieldLabel>{en.admin.assignments.sections}</FieldLabel>
            <Select value={sectionKinds.join(",")} onValueChange={(v) => setSectionKinds(v.split(",") as ("listening" | "reading")[])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="listening">{en.admin.assignments.listening}</SelectItem>
                <SelectItem value="reading">{en.admin.assignments.reading}</SelectItem>
                <SelectItem value="listening,reading">{en.admin.assignments.listeningReading}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{en.admin.assignments.due}</FieldLabel>
            <div className="flex flex-col gap-2 md:flex-row md:items-start">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-between border-neutral-700 bg-neutral-900 font-normal text-xs">
                    {formatDateLabel(dueDate)}
                    <CaretDown className="size-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 border-neutral-700 bg-neutral-900" align="start">
                  <div className="w-full">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} captionLayout="label" className="w-full [--cell-size:1.85rem] md:[--cell-size:2.2rem]"/>
                  </div>
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-28"
              />
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={!testId || group.members.length === 0}
            onClick={async () => {
              const dueAt = buildDueAt(dueDate, dueTime);
              const res = await adminAssignToGroup(group.id, { type: "homework", testId, sectionKinds, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
              toast.success(en.admin.toasts.assignedToCount(res.count));
              setOpen(false);
            }}
          >
            {en.admin.groups.assignToCount(group.members.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestSelect({ tests, value, onChange }: { tests: TestSummary[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = tests.find((t) => t.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal border-neutral-700 bg-neutral-900">
          {selected ? selected.title : en.admin.assignments.selectTest}
          <CaretDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-neutral-700 bg-neutral-900" align="start">
        <Command className="bg-neutral-900">
          <CommandInput placeholder={en.admin.assignments.searchTest} className="h-8 text-xs" />
          <CommandList className="max-h-60">
            <CommandEmpty className="text-xs py-3 text-center px-2">{en.admin.assignments.noTest}</CommandEmpty>
            <CommandGroup>
              {tests.map((t) => (
                <CommandItem key={t.id} value={t.title} className="text-xs" onSelect={() => { onChange(t.id); setOpen(false); }}>
                  {t.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CreateTestDialog({ onCreate }: {
  onCreate: (payload: { title: string; durationMinutes: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("120");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus weight="bold" className="size-3" /> New Test</Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader><DialogTitle className="text-sm">Create Test</DialogTitle></DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>{en.admin.tests.dialog.titleLabel}</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Academic Practice Test 1" />
          </Field>
          <Field>
            <FieldLabel>{en.admin.tests.dialog.duration}</FieldLabel>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={1} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button disabled={!title.trim()} onClick={async () => {
            await onCreate({ title: title.trim(), durationMinutes: Number(duration) || 120 });
            setTitle(""); setDuration("120"); setOpen(false);
          }}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadTestButton({ onUpload }: {
  onUpload: (testData: TestDetail) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as TestDetail;
      if (!data.title || !Array.isArray(data.sections)) { toast.error("Invalid test JSON."); return; }
      await onUpload(data);
    } catch { toast.error("Failed to parse JSON file."); }
    e.target.value = "";
  };
  return (
    <>
      <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      <Button size="sm" className="gap-1" onClick={() => inputRef.current?.click()}>
        <Plus weight="bold" className="size-3" /> Upload JSON
      </Button>
    </>
  );
}
