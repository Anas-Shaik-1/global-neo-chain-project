import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { useAppSelector } from "@/app/hooks";
import { useEmployee, useUpdateEmployee } from "../api/hooks";
import { AvatarUpload } from "../components/AvatarUpload";
import { ResumeUpload } from "../components/ResumeUpload";
import { ProfileEditSchema, type ProfileEditValues } from "../schemas";

export function ProfilePage() {
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployee(me?.id);
  const update = useUpdateEmployee(me?.id ?? "");

  const form = useForm<ProfileEditValues>({
    resolver: zodResolver(ProfileEditSchema),
    defaultValues: { name: "", phone: "", bio: "" },
  });

  // Reset the form once profile data arrives (and any time it refetches),
  // so dirty-tracking accurately reflects edits relative to the latest values.
  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name,
        phone: data.phone ?? "",
        bio: data.bio ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!me) return null;
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const fallbackInitials = data.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function onSave(values: ProfileEditValues) {
    // Only send fields the user actually edited — keeps PATCH bodies minimal
    // and preserves existing test contract (only `bio` flows when only bio
    // was typed into).
    const dirty = form.formState.dirtyFields;
    const patch: Record<string, unknown> = {};
    if (dirty.name) patch.name = values.name;
    if (dirty.phone) patch.phone = values.phone ?? "";
    if (dirty.bio) patch.bio = values.bio ?? "";
    if (Object.keys(patch).length === 0) return;
    update.mutate(patch);
  }

  return (
    <PageContainer width="narrow" className="space-y-8">
      <PageHeader
        title="My profile"
        description="Keep your contact details, bio and resume up to date — your team sees this in the directory."
      />

      <section className="space-y-6">
        <AvatarUpload userId={data.id} currentUrl={data.avatarUrl} fallback={fallbackInitials} />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  value={data.email}
                  disabled
                  className="font-mono text-xs"
                />
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label htmlFor="profile-jobtitle">Job title</Label>
                <Input
                  id="profile-jobtitle"
                  value={data.jobTitle ?? ""}
                  disabled
                />
              </div>
              <div className="col-span-full">
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[96px]"
                          placeholder="A short intro for your colleagues."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <Button type="submit" disabled={update.isPending || form.formState.isSubmitting}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Form>
      </section>

      <Card>
        <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
        <CardContent>
          <ResumeUpload userId={data.id} currentUrl={data.resumeUrl} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
