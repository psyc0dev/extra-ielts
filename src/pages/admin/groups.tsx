import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash, UserMinus, Users, CaretDown } from "@phosphor-icons/react";
import {
  adminCreateGroup,
  adminDeleteGroup,
  adminRemoveGroupMember,
  adminAssignToGroup,
  adminGetStudentStats,
  adminListInvitations,
  adminInviteStudent,
  type ApiUser,
  type TestSummary,
  type Group,
  type StudentStats,
  type Invitation,
} from "@/lib/api";
import { toast } from "sonner";
import { TestSelect } from "./tests";
import { buildDueAt, formatDateLabel } from "./lib";
import en from "@/locales/en";

export function GroupsSection({ groups, users, tests, query, onQueryChange, isAdmin, onViewGroup, onGroupCreated, onGroupDeleted, onMemberRemoved }: {
  groups: Group[];
  users: ApiUser[];
  tests: TestSummary[];
  query: string;
  onQueryChange: (q: string) => void;
  isAdmin: boolean;
  onViewGroup: (group: Group) => void;
  onGroupCreated: (g: Group) => void;
  onGroupDeleted: (id: string) => void;
  onMemberRemoved: (groupId: string, userId: string) => void;
}) {
  const visibleGroups = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  })();

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-xs font-semibold">{en.admin.groups.title}</CardTitle>
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={en.admin.groups.search}
          className="max-w-xs"
        />
      </CardHeader>
      <CardContent>
        <GroupsPanel
          groups={visibleGroups}
          users={users}
          tests={tests}
          isAdmin={isAdmin}
          onViewGroup={onViewGroup}
          onGroupCreated={onGroupCreated}
          onGroupDeleted={onGroupDeleted}
          onMemberRemoved={onMemberRemoved}
        />
      </CardContent>
    </Card>
  );
}

export function GroupDetailsPage({
  group,
  currentUserId,
  onBack,
  onViewUser,
  onMemberRemoved,
}: {
  group: Group;
  currentUserId: string | null;
  onBack: () => void;
  onViewUser: (userId: string) => void;
  onMemberRemoved: (groupId: string, userId: string) => void;
}) {
  const [statsByUser, setStatsByUser] = useState<Record<string, StudentStats | null>>({});
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

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

  useEffect(() => {
    let mounted = true;
    adminListInvitations(group.id)
      .then((res) => { if (mounted) setInvitations(res.invitations); })
      .catch(() => {})
    return () => { mounted = false; };
  }, [group.id]);

  const pendingInvitations = invitations.filter((r) => r.status === "pending");

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;
    setInviteBusy(true);
    try {
      await adminInviteStudent(group.id, inviteUsername.trim());
      setInviteUsername("");
      const res = await adminListInvitations(group.id);
      setInvitations(res.invitations);
      toast.success(en.admin.groupDetails.inviteSent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xs font-semibold">{en.admin.groupDetails.title}</CardTitle>
          <div className="text-xs text-muted-foreground mt-1">{en.admin.groupDetails.membersCount(group.name, group.members.length)}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder={en.admin.groupDetails.invitePlaceholder}
              className="h-7 w-40 text-xs"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
            />
            <Button size="sm" className="h-7 text-xs gap-1" disabled={!inviteUsername.trim() || inviteBusy} onClick={handleInvite}>
              <Plus weight="bold" className="size-3" /> {en.admin.groupDetails.inviteStudent}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onBack}>
            {en.admin.groupDetails.backButton}
          </Button>
        </div>
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
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-700" onClick={() => onViewUser(member.id)}>
                        {en.admin.users.viewStats}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={async () => {
                        await adminRemoveGroupMember(group.id, member.id);
                        onMemberRemoved(group.id, member.id);
                      }}>
                        <Trash weight="bold" className="size-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        )}

        {pendingInvitations.length > 0 && (
          <>
            <Separator className="my-4 bg-neutral-800" />
            <div className="text-xs font-semibold mb-2">{en.admin.groupDetails.pendingInvitations} ({pendingInvitations.length})</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{en.admin.groupDetails.tableHeaders.student}</TableHead>
                  <TableHead>{en.admin.groupDetails.invitedBy}</TableHead>
                  <TableHead>{en.admin.groupDetails.joinRequestDate}</TableHead>
                  <TableHead>{en.admin.groupDetails.invitationStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.username}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{inv.invitedByName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] border-yellow-700 text-yellow-400">{en.admin.groupDetails.statusPending}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GroupsPanel({
  groups,
  users,
  tests,
  isAdmin,
  onViewGroup,
  onGroupCreated,
  onGroupDeleted,
  onMemberRemoved,
}: {
  groups: Group[];
  users: ApiUser[];
  tests: TestSummary[];
  isAdmin: boolean;
  onViewGroup: (group: Group) => void;
  onGroupCreated: (g: Group) => void;
  onGroupDeleted: (id: string) => void;
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
            isAdmin={isAdmin}
            onView={() => onViewGroup(group)}
            onDelete={async () => {
              await adminDeleteGroup(group.id);
              onGroupDeleted(group.id);
              toast.success(en.admin.groups.delete);
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
  isAdmin,
  onView,
  onDelete,
  onRemoveMember,
}: {
  group: Group;
  users: ApiUser[];
  tests: TestSummary[];
  isAdmin: boolean;
  onView: () => void;
  onDelete: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}) {

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
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-950/30"
              onClick={onDelete}
            >
              <Trash weight="bold" className="size-3" />
            </Button>
          )}
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
      </CardContent>
    </Card>
  );
}


export function CreateGroupDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
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

export function AssignGroupHomeworkDialog({ group, tests }: { group: Group; tests: TestSummary[] }) {
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
