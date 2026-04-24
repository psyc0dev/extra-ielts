import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import {
  adminCreateUser,
  adminCreateGroup,
  adminListUsers,
  adminListStudents,
  adminListTests,
  adminListAssignments,
  adminListGroups,
  adminUploadTest,
  type AdminAssignment,
  type ApiUser,
  type TestSummary,
  type TestDetail,
  type Group,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Users,
  BookOpen as BookOpenIcon,
  Gauge,
  ClipboardText,
  UsersThree,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/use-auth";
import en from "@/locales/en";

import { type AdminSection, type NavItem } from "./admin/lib";
import { OverviewSection } from "./admin/overview";
import { UsersSection, UserDetailsPage, CreateUserDialog } from "./admin/users";
import { TestsSection, UploadTestButton } from "./admin/tests";
import { TestBuilderDialog } from "@/components/test-builder";
import { AssignmentsSection, CreateAssignmentDialog } from "./admin/assignments";
import { GroupsSection, GroupDetailsPage, CreateGroupDialog } from "./admin/groups";

export function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
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
    if (isAdmin) {
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
    } else {
      const [testsRes, homeworkRes, groupsRes, studentsRes] = await Promise.all([
        adminListTests(),
        adminListAssignments("homework"),
        adminListGroups(),
        adminListStudents(),
      ]);
      setTests(testsRes.tests);
      setHomeworkAssignments(homeworkRes.assignments);
      setGroups(groupsRes.groups);
      setUsers(studentsRes.users);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    loadAll().catch((err) => toast.error(err.message));
  }, [loadAll]);

  const testMap = useMemo(
    () => new Map(tests.map((test) => [test.id, test.title])),
    [tests]
  );

  const navItems: NavItem[] = [
    { id: "overview", label: en.admin.sections.overview, description: en.admin.sections.overviewSub, icon: <Gauge weight="bold" className="size-4" /> },
    ...(isAdmin ? [{ id: "users" as AdminSection, label: en.admin.sections.users, description: en.admin.sections.usersSub, icon: <UsersThree weight="bold" className="size-4" /> }] : []),
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
                  <TestBuilderDialog
                    onCreated={(test) => {
                      setTests((prev) => [test, ...prev]);
                    }}
                  />
                  <UploadTestButton
                    onUpload={async (testData) => {
                      const res = await adminUploadTest(testData);
                      setTests((prev) => [
                        { id: res.test.id, title: testData.title, durationMinutes: testData.durationMinutes, sectionsCount: testData.sections.length, questionsCount: testData.sections.reduce((n, s) => n + s.questions.length, 0), published: false },
                        ...prev,
                      ]);
                      toast.success(en.admin.toasts.testUploaded);
                    }}
                  />
                </div>
              )}
              {section === "users" && isAdmin && (
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
                    toast.success(en.admin.toasts.assignmentCreated);
                    setHomeworkAssignments((prev) => [
                      {
                        id: crypto.randomUUID(),
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
            <OverviewSection
              users={users.length}
              tests={tests.length}
              homeworkAssignments={homeworkAssignments.length}
              groups={groups.length}
              loading={sk}
            />
          )}

          {section === "users" && isAdmin && (
            <UsersSection
              users={users}
              query={userQuery}
              onQueryChange={setUserQuery}
              loading={sk}
              onViewUser={(target) => { setSelectedUser(target); setSection("user-details"); }}
            />
          )}

          {section === "tests" && (
            <TestsSection
              tests={tests}
              query={testQuery}
              onQueryChange={setTestQuery}
              loading={sk}
              isAdmin={isAdmin}
              onTestsChange={setTests}
            />
          )}

          {section === "assignments" && (
            <AssignmentsSection
              assignments={homeworkAssignments}
              testMap={testMap}
              query={assignmentQuery}
              onQueryChange={setAssignmentQuery}
              loading={sk}
            />
          )}

          {section === "groups" && (
            <GroupsSection
              groups={groups}
              users={users}
              tests={tests}
              query={groupQuery}
              onQueryChange={setGroupQuery}
              isAdmin={isAdmin}
              onViewGroup={(group) => {
                setSelectedGroup(group);
                setSection("group-details");
              }}
              onGroupCreated={(g) => setGroups((prev) => [g, ...prev])}
              onGroupDeleted={(id) => setGroups((prev) => prev.filter((g) => g.id !== id))}
              onMemberAdded={(groupId, user) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: [...g.members, user] } : g))}
              onMemberRemoved={(groupId, userId) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: g.members.filter((m) => m.id !== userId) } : g))}
            />
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
              onMemberRemoved={(groupId, userId) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: g.members.filter((m) => m.id !== userId) } : g))}
              allUsers={users}
            />
          )}

            </motion.div>
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
  );
}
