import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppSelector } from "@/app/hooks";
import { useAllPayslips, useMyPayslips } from "../api/hooks";
import { PayslipsTable } from "../components/PayslipsTable";
import { GeneratePayslipForm } from "../components/GeneratePayslipForm";

function MyPayslipsTab() {
  const [month, setMonth] = useState("");
  const params = useMemo(() => {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? { month, limit: 100 }
      : { limit: 100 };
  }, [month]);
  const q = useMyPayslips(params);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>My payslips</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="my-payslip-month" className="text-sm">
            Month
          </Label>
          <Input
            id="my-payslip-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
            className="h-9 w-[10rem]"
          />
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading || !q.data ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <PayslipsTable
            payslips={q.data.items}
            emptyState="You don't have any payslips yet."
          />
        )}
      </CardContent>
    </Card>
  );
}

function AllPayslipsTab() {
  const [month, setMonth] = useState("");
  const [userId, setUserId] = useState("");
  const params = useMemo(() => {
    const p: Record<string, unknown> = { limit: 100 };
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) p.month = month;
    if (/^[0-9a-fA-F]{24}$/.test(userId)) p.userId = userId;
    return p;
  }, [month, userId]);
  const q = useAllPayslips(params);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <CardTitle>All payslips</CardTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="all-payslip-month" className="text-xs">
              Month
            </Label>
            <Input
              id="all-payslip-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="YYYY-MM"
              className="h-9 w-[10rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="all-payslip-user" className="text-xs">
              User ID
            </Label>
            <Input
              id="all-payslip-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="24-char hex"
              className="h-9 w-[16rem]"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading || !q.data ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <PayslipsTable
            payslips={q.data.items}
            showOwner
            emptyState="No payslips match this filter."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function PayrollPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isElevated = role === "HR" || role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Generate and download payslips." />

      {isElevated ? (
        <Tabs defaultValue="mine" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mine">My payslips</TabsTrigger>
            <TabsTrigger value="all">All payslips</TabsTrigger>
            <TabsTrigger value="generate">Generate payslip</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="space-y-4">
            <MyPayslipsTab />
          </TabsContent>
          <TabsContent value="all" className="space-y-4">
            <AllPayslipsTab />
          </TabsContent>
          <TabsContent value="generate" className="space-y-4">
            <GeneratePayslipForm />
          </TabsContent>
        </Tabs>
      ) : (
        <MyPayslipsTab />
      )}
    </div>
  );
}
