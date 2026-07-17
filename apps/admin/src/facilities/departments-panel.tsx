import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createDepartmentTask,
  fetchDepartmentTasks,
  listDepartments,
  updateDepartmentTaskStatus,
  type DepartmentDto,
  type DepartmentTaskDto,
  type TaskPriority,
  type TaskStatus,
} from "@hotelos/web-client";

export type DepartmentsPanelProps = {
  readonly hotelId: string;
};

const priorityLabel: Record<TaskPriority, string> = {
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  urgent: "דחוף",
};

const statusLabel: Record<TaskStatus, string> = {
  open: "פתוחה",
  in_progress: "בטיפול",
  blocked: "חסומה",
  done: "הושלמה",
  cancelled: "בוטלה",
};

const nextStatusOptions: Record<TaskStatus, readonly TaskStatus[]> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["blocked", "done", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

export function DepartmentsPanel({ hotelId }: DepartmentsPanelProps) {
  const [departments, setDepartments] = useState<readonly DepartmentDto[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | undefined>();
  const [tasks, setTasks] = useState<readonly DepartmentTaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [taskType, setTaskType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await listDepartments(hotelId);
        if (cancelled) return;
        setDepartments(data);
        setSelectedCode((prev) => prev ?? data[0]?.code);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    if (!selectedCode) {
      setTasks([]);
      return;
    }
    const code = selectedCode;
    let cancelled = false;
    async function loadTasks() {
      setTasksLoading(true);
      setError(undefined);
      try {
        const data = await fetchDepartmentTasks(hotelId, code);
        if (!cancelled) setTasks(data.tasks);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    }
    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [hotelId, selectedCode]);

  async function onCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const created = await createDepartmentTask(hotelId, selectedCode, {
        taskType: taskType.trim() || "general",
        title,
        description,
        priority,
      });
      setTasks((prev) => [created, ...prev]);
      setTaskType("");
      setTitle("");
      setDescription("");
      setPriority("medium");
    } catch (submitError) {
      setCreateError(
        submitError instanceof Error ? submitError.message : "יצירה נכשלה",
      );
    } finally {
      setCreating(false);
    }
  }

  async function onChangeStatus(taskId: string, status: TaskStatus) {
    try {
      const updated = await updateDepartmentTaskStatus(taskId, status);
      setTasks((prev) =>
        prev.map((task) => (task.id === updated.id ? updated : task)),
      );
    } catch {
      setError("עדכון הסטטוס נכשל, נסו שוב");
    }
  }

  return (
    <div className="panel">
      {loading ? <p className="state">טוען מחלקות…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="dept-chips">
        {departments.map((dept) => (
          <button
            key={dept.id}
            type="button"
            className={dept.code === selectedCode ? "chip chip--on" : "chip"}
            onClick={() => setSelectedCode(dept.code)}
          >
            {dept.name}
            <span className="chip__count">{dept.staffCount}</span>
          </button>
        ))}
      </div>

      {selectedCode ? (
        <section className="card">
          <h2>
            משימות ·{" "}
            {departments.find((d) => d.code === selectedCode)?.name ??
              selectedCode}
          </h2>
          {tasksLoading ? <p className="state">טוען משימות…</p> : null}
          {!tasksLoading && tasks.length === 0 ? (
            <p className="hint">אין משימות פתוחות במחלקה זו.</p>
          ) : null}
          <ul className="list">
            {tasks.map((task) => (
              <li key={task.id} className="row row--task">
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                  <p className="meta">
                    סוג: {task.taskType} · עדיפות: {priorityLabel[task.priority]}
                    {task.dueAt ? ` · יעד: ${task.dueAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="row__actions">
                  <span className={`status status--task-${task.status}`}>
                    {statusLabel[task.status]}
                  </span>
                  {nextStatusOptions[task.status].map((next) => (
                    <button
                      key={next}
                      type="button"
                      className="mini-btn"
                      onClick={() => void onChangeStatus(task.id, next)}
                    >
                      {statusLabel[next]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <form className="create-form" onSubmit={onCreateTask} noValidate>
            <h3>משימה חדשה</h3>
            <TextField
              label="סוג משימה"
              name="taskType"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              placeholder="לדוגמה: ניקיון, בדיקה, החלפה"
            />
            <TextField
              label="כותרת"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <label className="select-field">
              <span>תיאור</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
              />
            </label>
            <label className="select-field">
              <span>עדיפות</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {(Object.keys(priorityLabel) as TaskPriority[]).map((key) => (
                  <option key={key} value={key}>
                    {priorityLabel[key]}
                  </option>
                ))}
              </select>
            </label>
            {createError !== undefined ? (
              <p className="state state--error" role="alert">
                {createError}
              </p>
            ) : null}
            <Button type="submit" disabled={creating}>
              {creating ? "יוצר…" : "צור משימה"}
            </Button>
          </form>
        </section>
      ) : null}

      <style>{`
        .panel { display:grid; gap:var(--space-4); }
        .dept-chips { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .chip { display:flex; align-items:center; gap:.4rem; border:1px solid rgb(16 36 31 / 14%); background:var(--color-paper-elevated); border-radius:999px; padding:.5rem .9rem; font:inherit; font-weight:600; cursor:pointer; }
        .chip--on { background:var(--color-sea-deep); color:#fff; border-color:transparent; }
        .chip__count { font-size:var(--text-small); opacity:.75; }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-4); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:0; color:var(--color-ink-soft); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row--task { align-items:flex-start; }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.1rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .row .meta { color:var(--color-ink-soft); }
        .row__actions { display:flex; flex-direction:column; gap:var(--space-2); align-items:flex-end; }
        .status { font-size:var(--text-small); font-weight:700; padding:.35rem .7rem; border-radius:999px; white-space:nowrap; }
        .status--task-open { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .status--task-in_progress { color:#8a5a12; background:rgb(138 90 18 / 12%); }
        .status--task-blocked { color:#9b2c2c; background:rgb(155 44 44 / 12%); }
        .status--task-done { color:#0f6a5c; background:rgb(15 106 92 / 12%); }
        .status--task-cancelled { color:#445; background:rgb(68 68 85 / 10%); }
        .mini-btn { font:inherit; font-size:var(--text-small); border:1px solid rgb(16 36 31 / 18%); background:transparent; border-radius:var(--radius-sm); padding:.3rem .6rem; cursor:pointer; font-weight:600; }
        .create-form { display:grid; gap:var(--space-3); border-top:1px solid rgb(16 36 31 / 10%); padding-top:var(--space-4); }
        .create-form h3 { margin:0; font-family:var(--font-display); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select, .select-field textarea { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); resize:vertical; }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </div>
  );
}
