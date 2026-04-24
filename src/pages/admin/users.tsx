import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Plus, Trophy, Headphones, BookOpen as BookOpenIcon } from "@phosphor-icons/react";
import { adminCreateUser, adminGetStudentStats, type ApiUser, type StudentStats } from "@/lib/api";
import { toast } from "sonner";
import en from "@/locales/en";

function StatChip({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-bold flex items-center gap-1">{icon}{value}</span>
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

export function UsersSection({ users, query, onQueryChange, loading, onViewUser }: {
  users: ApiUser[];
  query: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
  onViewUser: (user: ApiUser) => void;
}) {
  const visibleUsers = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.username, u.email, u.role].some((v) => (v ?? "").toLowerCase().includes(q)));
  })();

  return (
    <Card className="border-neutral-800 bg-neutral-900">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-xs font-semibold">{en.admin.users.title}</CardTitle>
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
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
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>)}
              </TableRow>
            )) : visibleUsers.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">{en.admin.users.notFound}</TableCell></TableRow>
            ) : visibleUsers.map((user) => (
              <UserRow key={user.id} user={user} onView={onViewUser} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function UserDetailsPage({ user, testMap, onBack }: { user: ApiUser; testMap: Map<string, string>; onBack: () => void }) {
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
          <div className="text-xs text-muted-foreground mt-1">{user.username} — {user.email ?? en.common.na}</div>
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

export function CreateUserDialog({ onCreate }: { onCreate: (payload: { username: string; email?: string; password: string; role: "admin" | "teacher" | "student" }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "student">("student");

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
            <Select value={role} onValueChange={(value) => setRole(value as "admin" | "teacher" | "student")}>
              <SelectTrigger>
                <SelectValue placeholder={en.admin.users.dialog.role} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">{en.admin.users.dialog.roleStudent}</SelectItem>
                <SelectItem value="teacher">{en.admin.users.dialog.roleTeacher}</SelectItem>
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
