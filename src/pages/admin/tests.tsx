import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Plus, CaretDown } from "@phosphor-icons/react";
import { adminToggleTestPublished, adminDeleteTest, adminUploadTest, getToken, type TestSummary, type TestDetail } from "@/lib/api";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-shell";
import { TestBuilderDialog } from "@/components/test-builder";
import en from "@/locales/en";

export function TestsSection({ tests, query, onQueryChange, loading, isAdmin, onTestsChange }: {
  tests: TestSummary[];
  query: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
  isAdmin: boolean;
  onTestsChange: (tests: TestSummary[] | ((prev: TestSummary[]) => TestSummary[])) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<TestSummary | null>(null);

  const visibleTests = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => t.title.toLowerCase().includes(q));
  })();

  const togglePublished = useCallback(async (testId: string, published: boolean) => {
    try {
      await adminToggleTestPublished(testId, published);
      onTestsChange((prev) => prev.map((t) => t.id === testId ? { ...t, published } : t));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.admin.errors.updateFailed);
    }
  }, [onTestsChange]);

  const handleDownloadTest = useCallback(async (test: TestSummary) => {
    try {
      if (!test.sectionsCount) {
        toast.error(en.admin.toasts.testEmpty);
        return;
      }
      const token = getToken();
      if (!token) {
        toast.error(en.admin.toasts.missingAuth);
        return;
      }
      const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const url = `${base}/admin/tests/${test.id}/download?token=${encodeURIComponent(token)}`;
      await open(url);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : en.admin.toasts.downloadFailed);
    }
  }, []);

  const confirmDeleteTest = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteTest(deleteTarget.id);
      onTestsChange((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success(en.admin.toasts.testDeleted);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : en.admin.toasts.deleteFailed);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, onTestsChange]);

  return (
    <>
      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xs font-semibold">{en.admin.tests.title}</CardTitle>
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={en.admin.tests.search}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">{en.admin.tests.table.title}</TableHead>
                <TableHead className="text-center">{en.admin.tests.table.duration}</TableHead>
                <TableHead className="text-center">{en.admin.tests.table.sections}</TableHead>
                <TableHead className="text-center">{en.admin.tests.table.status}</TableHead>
                <TableHead className="text-center">{en.admin.tests.table.published}</TableHead>
                <TableHead className="text-center">{en.admin.tests.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>)}
                </TableRow>
              )) : visibleTests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">{en.admin.tests.notFound}</TableCell></TableRow>
              ) : visibleTests.map((test) => (
                <TableRow key={test.id}>
                  <TableCell className="font-medium text-center">{test.title}</TableCell>
                  <TableCell className="text-muted-foreground text-center">{test.durationMinutes} {en.admin.tests.minutesSuffix}</TableCell>
                  <TableCell className="text-muted-foreground text-center">{test.sectionsCount}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={test.published
                        ? "border-emerald-800 text-emerald-400"
                        : "border-neutral-700 text-muted-foreground"}
                    >
                      {test.published ? en.admin.tests.status.published : en.admin.tests.status.draft}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={test.published ?? false}
                        onCheckedChange={(checked) => togglePublished(test.id, checked)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-700" onClick={() => handleDownloadTest(test)}>
                        {en.admin.tests.actions.downloadJson}
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-700 text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(test)}>
                          {en.admin.tests.actions.delete}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="border-neutral-800 bg-neutral-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">{en.admin.tests.actions.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {deleteTarget ? en.admin.tests.actions.deleteConfirmDesc(deleteTarget.title) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">{en.admin.tests.actions.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction className="text-xs" onClick={confirmDeleteTest}>
              {en.admin.tests.actions.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TestSelect({ tests, value, onChange }: { tests: TestSummary[]; value: string; onChange: (v: string) => void }) {
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

export function CreateTestDialog({ onCreate }: {
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

export function UploadTestButton({ onUpload }: {
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
