import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import en from "@/locales/en";

export function OverviewSection({ users, tests, homeworkAssignments, groups, loading }: {
  users: number;
  tests: number;
  homeworkAssignments: number;
  groups: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-neutral-800 bg-neutral-950/50">
            <CardHeader className="pb-2"><Skeleton className="h-3 w-20" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-12" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <Card className="border-neutral-800 bg-neutral-950/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">{en.admin.overview.users}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{users}</CardContent>
      </Card>
      <Card className="border-neutral-800 bg-neutral-950/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">{en.admin.overview.tests}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{tests}</CardContent>
      </Card>
      <Card className="border-neutral-800 bg-neutral-950/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">{en.admin.overview.assignments}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{homeworkAssignments}</CardContent>
      </Card>
      <Card className="border-neutral-800 bg-neutral-950/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">{en.admin.overview.groups}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{groups}</CardContent>
      </Card>
    </div>
  );
}
