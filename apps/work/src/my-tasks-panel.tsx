import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  listDepartments,
  listHotels,
  fetchDepartmentTasks,
  updateDepartmentTaskStatus,
  type DepartmentTaskDto,
  type StoredUser,
  type TaskStatus,
} from "@hotelos/web-client";

type TaskRow = DepartmentTaskDto & { readonly departmentCode: string };

export function MyTasksPanel({ user }: { readonly user: StoredUser }) {
  const [tasks, setTasks] = useState<readonly TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | undefined>();

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const hotels = await listHotels();
      const hotelId = user.hotelId ?? hotels[0]?.id;
      if (!hotelId) {
        setTasks([]);
        setError("לא נמצא מלון לחשבון זה");
        return;
      }
      const departments = await listDepartments(hotelId);
      const rows: TaskRow[] = [];
      for (const dept of departments) {
        const data = await fetchDepartmentTasks(hotelId, dept.code);
        for (const task of data.tasks) {
          rows.push({ ...task, departmentCode: dept.code });
        }
      }
      const assigned = rows.filter((task) => task.assignedToUserId === user.id);
      const active = (list: readonly TaskRow[]) =>
        list.filter(
          (task) =>
            task.status === "open" ||
            task.status === "in_progress" ||
            task.status === "blocked",
        );
      const preferred = active(assigned.length > 0 ? assigned : rows);
      preferred.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      setTasks(preferred);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "טעינה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [user.id, user.hotelId]);

  async function setStatus(taskId: string, status: TaskStatus) {
    setBusyId(taskId);
    setError(undefined);
    try {
      await updateDepartmentTaskStatus(taskId, status);
      await reload();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "עדכון נכשל",
      );
    } finally {
      setBusyId(undefined);
    }
  }

  if (loading) return <p>טוען משימות…</p>;

  return (
    <section className="tasks">
      <h2>המשימות שלי</h2>
      <p className="muted">
        תור מחלקתי מהמלון — משימות פתוחות / בביצוע. אם אין משימות משויכות
        אליך, מוצגות משימות המחלקות במלון.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {tasks.length === 0 ? (
        <p className="muted">אין משימות פעילות כרגע.</p>
      ) : (
        <ul className="tasks__list">
          {tasks.map((task) => (
            <li key={task.id} className="tasks__item">
              <div className="tasks__head">
                <strong>{task.title}</strong>
                <span className="tasks__meta">
                  {task.departmentCode} · {task.priority} · {task.status}
                </span>
              </div>
              {task.description ? <p>{task.description}</p> : null}
              <div className="tasks__actions">
                {task.status === "open" ? (
                  <Button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => void setStatus(task.id, "in_progress")}
                  >
                    התחל
                  </Button>
                ) : null}
                {task.status === "open" || task.status === "in_progress" ? (
                  <Button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => void setStatus(task.id, "done")}
                  >
                    סמן בוצע
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .tasks{display:grid;gap:1rem;max-width:40rem}
        .tasks__list{list-style:none;padding:0;margin:0;display:grid;gap:.75rem}
        .tasks__item{border:1px solid var(--color-line-strong);border-radius:8px;padding:.85rem;background:var(--color-paper)}
        .tasks__head{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:space-between;margin-bottom:.35rem}
        .tasks__meta{font-size:.85rem;opacity:.75}
        .tasks__actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}
        .muted{opacity:.75}
        .error{color:#8b1e1e}
      `}</style>
    </section>
  );
}
