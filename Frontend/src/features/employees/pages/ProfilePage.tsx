import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { useEmployee, useUpdateEmployee, employeeKeys } from "../api/hooks";
import { AvatarUpload } from "../components/AvatarUpload";
import { ResumeUpload } from "../components/ResumeUpload";
import { useResendVerification } from "@/features/auth/api/hooks";
import { PhoneOtpDialog } from "@/features/auth/components/PhoneOtpDialog";
import { stripIndianPrefix } from "@/lib/phone";
import { ProfileEditSchema, type ProfileEditValues } from "../schemas";

export function ProfilePage() {
  const me = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useEmployee(me?.id);
  const update = useUpdateEmployee(me?.id ?? "");
  const resendVerification = useResendVerification();
  const qc = useQueryClient();
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);

  const form = useForm<ProfileEditValues>({
    resolver: zodResolver(ProfileEditSchema),
    defaultValues: { name: "", phone: "", bio: "" },
  });

  // Reset only when the loaded profile's identity changes (initial load /
  // viewing a different employee). Background refetches that return the same
  // user shouldn't clobber in-progress edits.
  useEffect(() => {
    if (data) {
      // Phone is stored as `+91XXXXXXXXXX`; strip the country-code prefix so
      // the edit field shows just the 10-digit subscriber number that the
      // user originally typed.
      form.reset({
        name: data.name,
        phone: stripIndianPrefix(data.phone),
        bio: data.bio ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

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
                      <div className="relative flex items-center">
                        <span className="pointer-events-none absolute left-3 select-none text-sm font-medium text-muted-foreground">
                          +91
                        </span>
                        <Input
                          autoComplete="tel-national"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="9876543210"
                          className="pl-12"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                        />
                      </div>
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
        <CardHeader><CardTitle>Verification</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{data.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge tone={me.isVerified ? "success" : "warn"}>
                {me.isVerified ? "Verified" : "Unverified"}
              </StatusBadge>
              {!me.isVerified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resendVerification.mutate()}
                  disabled={resendVerification.isPending}
                >
                  {resendVerification.isPending ? "Sending…" : "Resend email"}
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-xs text-muted-foreground">
                  {data.phone ?? "No phone number on file"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge tone={data.isPhoneVerified ? "success" : "warn"}>
                {data.isPhoneVerified ? "Verified" : "Unverified"}
              </StatusBadge>
              {!data.isPhoneVerified && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOtpDialogOpen(true)}
                  disabled={!data.phone}
                  title={!data.phone ? "Add a phone number above first" : undefined}
                >
                  Verify
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
        <CardContent>
          <ResumeUpload userId={data.id} currentUrl={data.resumeUrl} />
        </CardContent>
      </Card>

      {data.phone && (
        <PhoneOtpDialog
          open={otpDialogOpen}
          onOpenChange={setOtpDialogOpen}
          phone={data.phone}
          onVerified={() => {
            qc.invalidateQueries({ queryKey: employeeKeys.detail(data.id) });
          }}
        />
      )}
    </PageContainer>
  );
}
