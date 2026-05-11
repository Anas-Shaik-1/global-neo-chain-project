# Leave Requests — Design

**Status:** Approved
**Date:** 2026-05-11
**Scope:** Typed leave requests (categorised, no balances, no calendar/attendance auto-integration).

## Summary

Employees file leave requests with a type, date range, and reason. Only ADMIN can approve or reject. Requests stay PENDING until decided; the owner can cancel a PENDING request. No leave balances, no half-day support, no calendar/attendance auto-blocking — those are deferred.

## Roles & permissions

| Action | EMPLOYEE / TESTER / HR | ADMIN |
| --- | --- | --- |
| Create own request | yes | yes |
| List own requests | yes | yes |
| List all requests | no | yes |
| Cancel own request (PENDING only) | yes | yes |
| Approve / reject any request | no | yes |

HR is intentionally treated as an ordinary requester here. The user asked specifically for an admin-only approver, so HR does not gain decide-rights even though they hold them elsewhere (registration).

## Data model

New file: `Backend/src/models/leaveRequest.model.ts`.

```ts
LEAVE_TYPES   = ["CASUAL", "SICK", "ANNUAL", "UNPAID"]
LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]

LeaveRequest {
  userId         ObjectId (ref User, indexed)
  type           enum LEAVE_TYPES
  startDate      Date            // inclusive, day-precision (UTC midnight)
  endDate        Date            // inclusive, must be >= startDate
  reason         string          // 1..500 chars
  status         enum LEAVE_STATUSES, default PENDING, indexed
  decisionById   ObjectId? (ref User)        // null until decided
  decisionAt     Date?
  decisionNotes  string? (<=500)             // optional, admin's reject explanation
  createdAt, updatedAt
}
```

Indexes:
- `{ userId: 1, status: 1 }` — "my requests" view.
- `{ status: 1, startDate: -1 }` — admin queue ordered by upcoming start.

`startDate` / `endDate` are stored normalised to UTC midnight to avoid TZ skew on day-precision comparisons.

## API

New module: `Backend/src/modules/leaves/` with `leaves.routes.ts`, `leaves.controller.ts`, `leaves.service.ts`, `leaves.schema.ts`. Mounted at `/leaves` from `app.ts`.

| Method | Route | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/leaves` | Self (any user with `approvalStatus === ACTIVE`) | Create own request |
| `GET` | `/leaves/mine` | Self | List own requests, sorted `createdAt` desc |
| `GET` | `/leaves` | ADMIN | List all requests, filterable |
| `PATCH` | `/leaves/:id/cancel` | Owner | Cancel only if `status === PENDING` |
| `PATCH` | `/leaves/:id/approve` | ADMIN | Approve a PENDING request |
| `PATCH` | `/leaves/:id/reject` | ADMIN | Reject a PENDING request, optional notes |

### Request bodies (Zod)

- `POST /leaves` — `{ type: LeaveType, startDate: ISODate, endDate: ISODate, reason: string(1..500) }`
- `PATCH /leaves/:id/reject` — `{ notes?: string(<=500) }`
- `PATCH /leaves/:id/approve` and `PATCH /leaves/:id/cancel` — empty body.

### List filters (`GET /leaves`)

Admin list accepts query params `status`, `type`, `userId`, `from` (ISO date), `to` (ISO date), `page`, `pageSize`. `from`/`to` match requests whose `[startDate, endDate]` interval intersects the `[from, to]` window. Defaults: `status=PENDING`, `pageSize=20`, sorted by `startDate` ascending so the soonest-starting requests surface first.

### Validation rules

1. `startDate >= today` (UTC midnight) on create.
2. `endDate >= startDate`.
3. `reason` non-empty, ≤500 chars.
4. **Overlap guard**: rejecting on create with HTTP 409 if the user already has a `PENDING` or `APPROVED` request whose `[startDate, endDate]` intersects the new range.
5. Transition guards on decision endpoints: a non-`PENDING` request returns 409 with `"Leave is no longer pending"`.

### Status transitions

```
PENDING ─approve─▶ APPROVED   (terminal)
PENDING ─reject──▶ REJECTED   (terminal)
PENDING ─cancel──▶ CANCELLED  (terminal, owner-only)
```

No edits after submit — the owner cancels and re-creates if they need to change something.

## Notifications

Reuses `Backend/src/models/notification.model.ts` and whatever helper the existing modules use to dispatch (mirror what `bugs.service.ts` does for the bug-assignment notifications).

- **On create** → notification to every user where `role === "ADMIN"` and `isActive === true`. Title: `"New leave request from {employeeName}"`, link `/leaves`.
- **On approve / reject** → notification to the filer. Title: `"Leave request approved"` or `"Leave request rejected"`. If rejected with notes, include them in the body.
- **On cancel** → no notification (the request just disappears from the admin queue).

## Frontend

New folder: `Frontend/src/features/leaves/`.

```
features/leaves/
  api/
    hooks.ts              // useMyLeaves, useAllLeaves, useCreateLeave,
                          // useCancelLeave, useDecideLeave (approve | reject)
  components/
    RequestLeaveDialog.tsx
    LeaveRow.tsx          // shared row; admin variant exposes Approve/Reject
    LeaveStatusBadge.tsx  // colour-coded chip per status
  pages/
    LeavesPage.tsx        // role-branched: admin view vs employee view
  schemas.ts              // Zod schemas mirrored from backend for the form
```

### UX

- **Single `/leaves` route** rendering one of two layouts based on `me.role`:
  - **Employee view** — header CTA "Request leave" opens `RequestLeaveDialog`; below it, a paginated list of the user's own requests with status badges. Cancel button on PENDING rows.
  - **Admin view** — same header, but admin sees tabs (`Pending` | `All`) with a filter strip (type, employee). Each row carries inline Approve and Reject (Reject opens a small dialog for optional notes). Admins can also file their own requests via the same dialog — sees themselves in the list like anyone else.

### Wiring

- `Frontend/src/App.tsx` — register `/leaves` lazy-loaded.
- `Frontend/src/components/layout/SidebarNav.tsx` — add "Leaves" entry visible to all roles; icon: `lucide-react` `CalendarOff` (or similar).
- React Query keys: `["leaves", "mine"]` and `["leaves", "all", filters]`. Invalidate both after any mutation.

## Error handling

- 400 — Zod validation failures (bad dates, missing reason).
- 403 — Non-admin hitting an admin-only endpoint, or non-owner hitting `/cancel`.
- 404 — Decision endpoints on a non-existent id.
- 409 — Overlap on create, or decision/cancel on a non-PENDING request.

All errors flow through the existing `errorHandler` middleware. Frontend surfaces them via the existing `errorMessage()` toast helper.

## Testing

Mirror the level of coverage already present in `bugs.service.test.ts` / `payroll.service.test.ts`:

- **Service-level unit tests** (`leaves.service.test.ts`):
  - create succeeds with valid input
  - create rejects past start date / inverted range / overlap
  - approve / reject only allowed on PENDING; idempotency guard
  - cancel only allowed for owner and only on PENDING
  - filters on list (status, type, userId, date range)
- **Route-level integration test** (`leaves.routes.test.ts`):
  - happy path: create → admin approves → filer's view reflects status
  - 403 paths: employee hitting `/approve`; admin trying to cancel someone else's PENDING
- **Frontend**: light component test on `RequestLeaveDialog` validation (matches the style of existing dialog tests).

## Out of scope

Reserved for a future "Full HR-style" iteration:

- Per-employee annual leave balances / quotas.
- Half-day support.
- Auto-block on attendance for approved days.
- Calendar entries for approved leaves.
- Edit-after-submit (instead of cancel + recreate).
- Manager-tier approval (HR or PM as a first-level approver before admin).

## Migration

No schema migration needed — the new `LeaveRequest` collection is created on first insert. No backfill, no flag.
