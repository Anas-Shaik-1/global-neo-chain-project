import { useParams } from "react-router-dom";
import { Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAppSelector } from "@/app/hooks";
import { useCall } from "@/features/calls/CallProvider";
import { useEmployee, useDeactivateEmployee, type FullProfile } from "../api/hooks";

function isFullProfile(p: FullProfile | { id: string }): p is FullProfile {
  return "createdAt" in p;
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployee(id);
  const deactivate = useDeactivateEmployee();
  const call = useCall();
  const elevated = me?.role === "HR" || me?.role === "ADMIN";

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const initials = data.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const showFull = isFullProfile(data) && !!(data as FullProfile).createdAt;
  const full = data as FullProfile;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <CardTitle className="font-display text-3xl font-semibold tracking-tight">
                {data.name}
              </CardTitle>
              <div className="text-muted-foreground">
                {data.jobTitle ?? "—"} · {data.departmentName ?? "—"}
              </div>
              <StatusBadge tone={data.isActive ? "success" : "default"}>
                {data.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Email" value={data.email} />
          <Field label="Role" value={data.role} />
          <Field label="Phone" value={data.phone ?? "—"} />
          <Field label="Bio" value={data.bio ?? "—"} />
        </CardContent>
      </Card>

      {showFull && (
        <Card>
          <CardHeader><CardTitle>Sensitive details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Hire date" value={full.hireDate ? new Date(full.hireDate).toLocaleDateString() : "—"} />
            <Field label="Date of birth" value={full.dateOfBirth ? new Date(full.dateOfBirth).toLocaleDateString() : "—"} />
            <Field label="Address" value={full.address ?? "—"} />
            <Field label="Employment type" value={full.employmentType ?? "—"} />
            <Field label="Emergency contact" value={
              full.emergencyContact
                ? `${full.emergencyContact.name} (${full.emergencyContact.relationship}) · ${full.emergencyContact.phone}`
                : "—"
            } />
            <Field label="Resume" value={full.resumeUrl ? "uploaded" : "—"} link={full.resumeUrl ?? undefined} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {data.id !== me?.id && data.isActive && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              void call.start(data.id, data.name);
            }}
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
        )}
        {elevated && data.isActive && data.id !== me?.id && (
          <Button variant="destructive" onClick={() => deactivate.mutate(data.id)} disabled={deactivate.isPending}>
            {deactivate.isPending ? "Deactivating…" : "Deactivate employee"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="grid grid-cols-3 items-center text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">
        {link ? <a href={link} target="_blank" rel="noreferrer" className="text-primary underline">{value}</a> : value}
      </div>
    </div>
  );
}
