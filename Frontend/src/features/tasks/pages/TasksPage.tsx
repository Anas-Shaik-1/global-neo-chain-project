import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { RoleGate } from "@/features/auth/RoleGate";
import { KanbanBoard } from "../components/KanbanBoard";
import { CreateProjectDialog } from "../components/CreateProjectDialog";
import { CreateTaskDialog } from "../components/CreateTaskDialog";
import { TaskDetailDialog } from "../components/TaskDetailDialog";
import { useProjects, useTasks, type Task, type TaskStatus } from "../api/hooks";

export function TasksPage() {
  const projectsQ = useProjects({ limit: 100 });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const tasksQ = useTasks(selectedProjectId || undefined);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskInitialStatus, setCreateTaskInitialStatus] = useState<TaskStatus | undefined>(undefined);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Plan and track work across projects."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={!hasProjects}
              className="flex h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 py-1 text-sm"
              aria-label="Select project"
            >
              {!hasProjects && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
            <RoleGate roles={["PM", "HR", "ADMIN"]}>
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
        <CardContent className="pt-6">
          {projectsQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !hasProjects ? (
            <div className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No projects yet. Create your first project to get started.
            </div>
          ) : tasksQ.isLoading || !tasksQ.data ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <KanbanBoard
              tasks={tasksQ.data}
              onCardClick={(t) => setActiveTask(t)}
              onColumnAdd={onColumnAdd}
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
    </div>
  );
}
