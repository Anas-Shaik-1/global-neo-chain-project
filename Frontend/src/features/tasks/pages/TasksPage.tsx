import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGate } from "@/features/auth/RoleGate";
import { getApi } from "@/api/axios";
import { KanbanBoard } from "../components/KanbanBoard";
import { CreateProjectDialog } from "../components/CreateProjectDialog";
import { CreateTaskDialog } from "../components/CreateTaskDialog";
import { TaskDetailDialog } from "../components/TaskDetailDialog";
import { useProjects, useTasks, taskKeys, type Task, type TaskStatus } from "../api/hooks";

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

export function TasksPage() {
  const qc = useQueryClient();
  const projectsQ = useProjects({ limit: 100 });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const tasksQ = useTasks(selectedProjectId || undefined);

  const moveTask = useMutation({
    mutationFn: async (input: { taskId: string; status: TaskStatus }) => {
      const res = await getApi().patch(`/tasks/${input.taskId}`, { status: input.status });
      return res.data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: (err) => {
      const fallback = "Could not move task";
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ?? fallback
        : fallback;
      toast.error(msg);
    },
  });

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskInitialStatus, setCreateTaskInitialStatus] = useState<TaskStatus | undefined>(undefined);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");

  const filteredTasks = useMemo(() => {
    const all = tasksQ.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return all;
    return all.filter((task) => task.title.toLowerCase().includes(t));
  }, [tasksQ.data, search]);

  // Auto-select first project once projects load.
  useEffect(() => {
    if (!selectedProjectId && projectsQ.data && projectsQ.data.items.length > 0) {
      setSelectedProjectId(projectsQ.data.items[0]!.id);
    }
  }, [projectsQ.data, selectedProjectId]);

  // Keep activeTask in sync if its data refreshes.
  useEffect(() => {
    if (!activeTask) return;
    const fresh = tasksQ.data?.find((t) => t.id === activeTask.id);
    if (fresh && fresh !== activeTask) setActiveTask(fresh);
  }, [tasksQ.data, activeTask]);

  const projects = projectsQ.data?.items ?? [];
  const hasProjects = projects.length > 0;

  function onColumnAdd(status: TaskStatus) {
    setCreateTaskInitialStatus(status);
    setShowCreateTask(true);
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Plan and track work across projects."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedProjectId || undefined}
              onValueChange={setSelectedProjectId}
              disabled={!hasProjects}
            >
              <SelectTrigger
                aria-label="Select project"
                className="h-9 min-w-[12rem]"
              >
                <SelectValue placeholder={hasProjects ? "Select project" : "No projects"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RoleGate requirePM>
              <Button size="sm" variant="outline" onClick={() => setShowCreateProject(true)}>
                + New project
              </Button>
            </RoleGate>
            <Button
              size="sm"
              onClick={() => {
                setCreateTaskInitialStatus(undefined);
                setShowCreateTask(true);
              }}
              disabled={!selectedProjectId}
            >
              + New task
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          {hasProjects && !projectsQ.isLoading && (
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Filter tasks by title…"
              ariaLabel="Search tasks"
              className="max-w-md"
            />
          )}
          {projectsQ.isLoading ? (
            <KanbanSkeleton />
          ) : !hasProjects ? (
            <div className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No projects yet. Create your first project to get started.
            </div>
          ) : tasksQ.isLoading || !tasksQ.data ? (
            <KanbanSkeleton />
          ) : (
            <KanbanBoard
              tasks={filteredTasks}
              onCardClick={(t) => setActiveTask(t)}
              onColumnAdd={onColumnAdd}
              onTaskMove={(taskId, status) => moveTask.mutate({ taskId, status })}
            />
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onCreated={(p) => setSelectedProjectId(p.id)}
      />

      {selectedProjectId && (
        <CreateTaskDialog
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          projectId={selectedProjectId}
          initialStatus={createTaskInitialStatus}
        />
      )}

      <TaskDetailDialog
        open={!!activeTask}
        onOpenChange={(o) => {
          if (!o) setActiveTask(null);
        }}
        task={activeTask}
      />
    </PageContainer>
  );
}
