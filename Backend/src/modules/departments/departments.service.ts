import { Types } from "mongoose";
import { Department, type DepartmentDoc } from "../../models/department.model.js";
import { User } from "../../models/user.model.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";

interface DepartmentResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  employeeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

async function buildResponse(d: DepartmentDoc, employeeCount: number): Promise<DepartmentResponse> {
  let managerName: string | null = null;
  if (d.managerId) {
    const m = await User.findById(d.managerId).select("name").lean();
    managerName = m?.name ?? null;
  }
  const t = d as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: d._id.toString(),
    name: d.name,
    code: d.code,
    description: d.description ?? null,
    managerId: d.managerId ? d.managerId.toString() : null,
    managerName,
    employeeCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export interface CreateDeptInput {
  name: string;
  code: string;
  description?: string;
  managerId?: string;
}

export async function createDepartment(input: CreateDeptInput): Promise<DepartmentResponse> {
  try {
    const created = await Department.create({
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
    });
    return buildResponse(created, 0);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Department with this name or code already exists");
    }
    throw err;
  }
}

export async function listDepartments(input: { page?: number; limit?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const [docs, total] = await Promise.all([
    Department.find().sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    Department.countDocuments(),
  ]);
  const counts = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { departmentId: { $in: docs.map((d) => d._id) } } },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);
  const countById = new Map<string, number>();
  for (const c of counts) countById.set(c._id.toString(), c.count);
  const items = await Promise.all(docs.map((d) => buildResponse(d, countById.get(d._id.toString()) ?? 0)));
  return { items, total, page, limit };
}

export interface UpdateDeptInput {
  name?: string;
  code?: string;
  description?: string | null;
  managerId?: string | null;
}

export async function updateDepartment(id: string, patch: UpdateDeptInput): Promise<DepartmentResponse> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.code !== undefined) update.code = patch.code;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.managerId !== undefined) update.managerId = patch.managerId ? new Types.ObjectId(patch.managerId) : null;
  try {
    const d = await Department.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!d) throw new NotFoundError("Department");
    const employeeCount = await User.countDocuments({ departmentId: d._id });
    return buildResponse(d, employeeCount);
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw new ConflictError("Department with this name or code already exists");
    }
    throw err;
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  const count = await User.countDocuments({ departmentId: new Types.ObjectId(id) });
  if (count > 0) {
    throw new ConflictError(`Cannot delete department: ${count} employees still reference it`);
  }
  const result = await Department.findByIdAndDelete(id);
  if (!result) throw new NotFoundError("Department");
}
