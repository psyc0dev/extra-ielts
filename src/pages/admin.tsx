import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  type AdminAssignment,
  type ApiUser,
  type TestSummary,
  type Group,
  type StudentStats,
} from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, UserMinus, Users, Trophy, Headphones, BookOpen as BookOpenIcon, CaretDown, CaretUp } from "@phosphor-icons/react";

export function Admin() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState<AdminAssignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

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
  }, []);

  useEffect(() => {
    loadAll().catch((err) => toast.error(err.message));
  }, [loadAll]);

  const testMap = useMemo(
    () => new Map(tests.map((test) => [test.id, test.title])),
    [tests]
  );

  const togglePublished = async (testId: string, published: boolean) => {
    try {
      await adminToggleTestPublished(testId, published);
      setTests((prev) => prev.map((t) => t.id === testId ? { ...t, published } : t));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Admin Dashboard</h2>
          <p className="text-xs text-muted-foreground">Manage tests and homework.</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="homework">Homework</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold">Users</CardTitle>
              <CreateUserDialog
                onCreate={async (payload) => {
                  const res = await adminCreateUser(payload);
                  setUsers((prev) => [res.user, ...prev]);
                }}
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <UserRow key={user.id} user={user} testMap={testMap} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader>
              <CardTitle className="text-xs font-semibold">Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell className="font-medium">{test.title}</TableCell>
                      <TableCell className="text-muted-foreground">{test.durationMinutes} min</TableCell>
                      <TableCell className="text-muted-foreground">{test.sectionsCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={test.published
                            ? "border-emerald-800 text-emerald-400"
                            : "border-neutral-700 text-muted-foreground"}
                        >
                          {test.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={test.published ?? false}
                          onCheckedChange={(checked) => togglePublished(test.id, checked)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homework">
          <AssignmentPanel
            title="Homework Assignments"
            assignments={homeworkAssignments}
            tests={tests}
            users={users}
            testMap={testMap}
            type="homework"
            onCreated={(assignment) => setHomeworkAssignments((prev) => [assignment, ...prev])}
          />
        </TabsContent>

        <TabsContent value="groups">
          <GroupsPanel
            groups={groups}
            users={users}
            tests={tests}
            onGroupCreated={(g) => setGroups((prev) => [g, ...prev])}
            onGroupDeleted={(id) => setGroups((prev) => prev.filter((g) => g.id !== id))}
            onMemberAdded={(groupId, user) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: [...g.members, user] } : g))}
            onMemberRemoved={(groupId, userId) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, members: g.members.filter((m) => m.id !== userId) } : g))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserRow({ user, testMap }: { user: ApiUser; testMap: Map<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (user.role !== "student") return;
    if (!expanded && !stats) {
      setLoading(true);
      try {
        const res = await adminGetStudentStats(user.id);
        setStats(res.stats);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    setExpanded((v) => !v);
  };

  return (
    <>
      <TableRow className={user.role === "student" ? "cursor-pointer hover:bg-neutral-800/50" : ""} onClick={toggle}>
        <TableCell className="font-medium">{user.username}</TableCell>
        <TableCell className="text-muted-foreground">{user.email ?? "-"}</TableCell>
        <TableCell className="capitalize">{user.role}</TableCell>
        <TableCell className="w-6">
          {user.role === "student" && (
            expanded ? <CaretUp className="size-3 text-muted-foreground" /> : <CaretDown className="size-3 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>
      {expanded && user.role === "student" && (
        <TableRow>
          <TableCell colSpan={4} className="bg-neutral-950 p-4">
            {loading ? (
              <span className="text-xs text-muted-foreground">Loading…</span>
            ) : stats ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-3">
                  <StatChip label="Tests Done" value={`${stats.testsCompleted}/${stats.testsTotal}`} />
                  <StatChip label="Avg Band" value={stats.avgBand ?? "-"} icon={<Trophy weight="bold" className="size-3 text-amber-400" />} />
                  <StatChip label="Listening" value={stats.avgListeningBand ?? "-"} icon={<Headphones weight="bold" className="size-3 text-sky-400" />} />
                  <StatChip label="Reading" value={stats.avgReadingBand ?? "-"} icon={<BookOpenIcon weight="bold" className="size-3 text-violet-400" />} />
                </div>
                {stats.recentAttempts.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Recent</span>
                    {stats.recentAttempts.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded-md bg-neutral-900">
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
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No data</span>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
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

function AssignmentPanel({
  title,
  assignments,
  tests,
  users,
  testMap,
  type,
  onCreated,
}: {
  title: string;
  assignments: AdminAssignment[];
  tests: TestSummary[];
  users: ApiUser[];
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
          type={type}
          onCreate={async (payload) => {
            const res = await adminCreateAssignment({
              ...payload,
              dueAt: payload.dueAt ? new Date(payload.dueAt).toISOString() : null,
            });
            toast.success("Assignment created");
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
              <TableHead>Test</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell>{testMap.get(assignment.testId) ?? assignment.testId}</TableCell>
                <TableCell className="capitalize">{assignment.sectionKinds.join(", ")}</TableCell>
                <TableCell>{assignment.assignedToName}</TableCell>
                <TableCell className="text-muted-foreground">{assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : "-"}</TableCell>
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
          <Plus weight="bold" className="size-3" /> New User
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">Create User</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Username</FieldLabel>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          </Field>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          </Field>
          <Field>
            <FieldLabel>Password</FieldLabel>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="********" />
          </Field>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select value={role} onValueChange={(value) => setRole(value as "admin" | "student")}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={async () => {
              await onCreate({ username, email: email || undefined, password, role });
              toast.success("User created");
              setOpen(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateAssignmentDialog({
  tests,
  users,
  type,
  onCreate,
}: {
  tests: TestSummary[];
  users: ApiUser[];
  type: "task" | "homework";
  onCreate: (payload: { type: "task" | "homework"; testId: string; sectionKinds: ("listening" | "reading")[]; assignedTo: string; dueAt?: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [testId, setTestId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [sectionKinds, setSectionKinds] = useState<("listening" | "reading")[]>(["listening", "reading"]);
  const [dueAt, setDueAt] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus weight="bold" className="size-3" /> New Homework
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">Create Homework</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Test</FieldLabel>
            <Select value={testId} onValueChange={setTestId}>
              <SelectTrigger>
                <SelectValue placeholder="Select test" />
              </SelectTrigger>
              <SelectContent>
                {tests.map((test) => (
                  <SelectItem key={test.id} value={test.id}>{test.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Sections</FieldLabel>
            <Select
              value={sectionKinds.join(",")}
              onValueChange={(value) => setSectionKinds(value.split(",") as ("listening" | "reading")[])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="listening">Listening</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="listening,reading">Listening + Reading</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Assign To</FieldLabel>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {users.filter((user) => user.role === "student").map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Due Date (optional)</FieldLabel>
            <Input value={dueAt} onChange={(e) => setDueAt(e.target.value)} type="date" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={async () => {
              await onCreate({ type, testId, sectionKinds, assignedTo, dueAt: dueAt || null });
              setOpen(false);
            }}
            disabled={!testId || !assignedTo || sectionKinds.length === 0}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupsPanel({
  groups,
  users,
  tests,
  onGroupCreated,
  onGroupDeleted,
  onMemberAdded,
  onMemberRemoved,
}: {
  groups: Group[];
  users: ApiUser[];
  tests: TestSummary[];
  onGroupCreated: (g: Group) => void;
  onGroupDeleted: (id: string) => void;
  onMemberAdded: (groupId: string, user: { id: string; username: string; email: string | null }) => void;
  onMemberRemoved: (groupId: string, userId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
        <CreateGroupDialog
          onCreate={async (name) => {
            const res = await adminCreateGroup(name);
            onGroupCreated({ id: res.group.id, name: res.group.name, createdAt: new Date().toISOString(), members: [] });
            toast.success("Group created");
          }}
        />
      </div>
      {groups.length === 0 ? (
        <Card className="border-neutral-800 bg-neutral-900">
          <CardContent className="px-4 py-8 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-6 mb-1" />
            No groups yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            users={users}
            tests={tests}
            onDelete={async () => {
              await adminDeleteGroup(group.id);
              onGroupDeleted(group.id);
              toast.success("Group deleted");
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
  onDelete,
  onAddMember,
  onRemoveMember,
}: {
  group: Group;
  users: ApiUser[];
  tests: TestSummary[];
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
            {group.members.length} member{group.members.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <AssignGroupHomeworkDialog group={group} tests={tests} />
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
          <Plus weight="bold" className="size-3 mr-1 shrink-0" /> Add student…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 border-neutral-700 bg-neutral-900" align="start">
        <Command className="bg-neutral-900">
          <CommandInput placeholder="Search…" className="h-7 py-1 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="text-xs py-3 text-center px-2">No students found.</CommandEmpty>
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
          <Plus weight="bold" className="size-3" /> New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">Create Group</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel>Group Name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning Class" />
        </Field>
        <DialogFooter>
          <Button disabled={!name.trim()} onClick={async () => { await onCreate(name.trim()); setName(""); setOpen(false); }}>
            Create
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
  const [dueAt, setDueAt] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-neutral-700">
          <Plus weight="bold" className="size-3" /> Assign Homework
        </Button>
      </DialogTrigger>
      <DialogContent className="border-neutral-800 bg-neutral-950">
        <DialogHeader>
          <DialogTitle className="text-sm">Assign Homework to {group.name}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Test</FieldLabel>
            <Select value={testId} onValueChange={setTestId}>
              <SelectTrigger><SelectValue placeholder="Select test" /></SelectTrigger>
              <SelectContent>
                {tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Sections</FieldLabel>
            <Select value={sectionKinds.join(",")} onValueChange={(v) => setSectionKinds(v.split(",") as ("listening" | "reading")[])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="listening">Listening</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="listening,reading">Listening + Reading</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Due Date (optional)</FieldLabel>
            <Input value={dueAt} onChange={(e) => setDueAt(e.target.value)} type="date" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={!testId || group.members.length === 0}
            onClick={async () => {
              const res = await adminAssignToGroup(group.id, { type: "homework", testId, sectionKinds, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
              toast.success(`Assigned to ${res.count} student${res.count !== 1 ? "s" : ""}`);
              setOpen(false);
            }}
          >
            Assign to {group.members.length} student{group.members.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
