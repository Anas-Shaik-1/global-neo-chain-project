import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppSelector } from "@/app/hooks";
import { useEmployee, useUpdateEmployee } from "../api/hooks";
import { AvatarUpload } from "../components/AvatarUpload";
import { ResumeUpload } from "../components/ResumeUpload";

export function ProfilePage() {
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployee(me?.id);
  const update = useUpdateEmployee(me?.id ?? "");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  if (!me) return null;
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const fallbackInitials = data.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  function onSave() {
    const patch: Record<string, unknown> = {};
    if (name !== null) patch.name = name;
    if (phone !== null) patch.phone = phone;
    if (bio !== null) patch.bio = bio;
    if (Object.keys(patch).length > 0) update.mutate(patch);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="My profile"
        description="Keep your contact details, bio and resume up to date — your team sees this in the directory."
      />

      <section className="space-y-6">
        <AvatarUpload userId={data.id} currentUrl={data.avatarUrl} fallback={fallbackInitials} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue={data.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={data.email} disabled className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" defaultValue={data.phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" value={data.jobTitle ?? ""} disabled />
          </div>
          <div className="col-span-full space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={data.bio ?? ""}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short intro for your colleagues."
            />
          </div>
        </div>
        <Button onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <Card>
        <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
        <CardContent>
          <ResumeUpload userId={data.id} currentUrl={data.resumeUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
