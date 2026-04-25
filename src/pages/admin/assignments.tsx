import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CaretDown } from "@phosphor-icons/react";
import { adminCreateAssignment, adminAssignToGroup, adminLookupUser, type AdminAssignment, type ApiUser, type TestSummary, type Group } from "@/lib/api";
import { toast } from "sonner";
import { TestSelect } from "./tests";
import { buildDueAt, formatDateLabel } from "./lib";
import en from "@/locales/en";

export function AssignmentsSection({ assignments, testMap, query, onQueryChange, loading }: {
  assignments: AdminAssignment[];
  testMap: Map<string, string>;
  query: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
}) {
  const visibleAssignments = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) => {
      const title = testMap.get(a.testId) ?? a.testId;
      return `${title} ${a.assignedToName}`.toLowerCase().includes(q);
    });
  })();

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-xs font-semibold">{en.admin.assignments.title}</CardTitle>
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
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
            {loading ? Array.from({ length: 4 }).map((_, i) => (
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
  );
}

export function CreateAssignmentDialog({
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
  const [studentUsername, setStudentUsername] = useState("");
  const [studentLookup, setStudentLookup] = useState<ApiUser | null>(null);
  const [studentLookupBusy, setStudentLookupBusy] = useState(false);
  const [sectionKinds, setSectionKinds] = useState<("listening" | "reading")[]>(["listening", "reading"]);
  const [dueDate, setDueDate] = useState<Date>();
  const [dueTime, setDueTime] = useState("23:59");

  const handleLookupStudent = async () => {
    if (!studentUsername.trim()) return;
    setStudentLookupBusy(true);
    try {
      const res = await adminLookupUser(studentUsername.trim());
      setStudentLookup(res.user);
      setAssignedTo(res.user.id);
    } catch {
      setStudentLookup(null);
      setAssignedTo("");
      toast.error(en.admin.assignTo.userNotFound);
    } finally {
      setStudentLookupBusy(false);
    }
  };

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
                <div className="flex items-center gap-1.5">
                  <Input
                    value={studentUsername}
                    onChange={(e) => {
                      setStudentUsername(e.target.value);
                      setStudentLookup(null);
                      setAssignedTo("");
                    }}
                    placeholder={en.admin.assignTo.enterUsername}
                    className="h-8 text-xs"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLookupStudent(); }}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={!studentUsername.trim() || studentLookupBusy} onClick={handleLookupStudent}>
                    {en.admin.assignTo.lookup}
                  </Button>
                </div>
                {studentLookup && (
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {studentLookup.username} <span className="text-neutral-500">({studentLookup.role})</span>
                  </div>
                )}
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

export function AssignToGroupSelect({ groups, value, onChange }: { groups: Group[]; value: string; onChange: (v: string) => void }) {
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

export function AssignmentPanel({
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
