
import { useEffect, useMemo, useState } from "react";
import {
  Check, CheckCheck, Circle, ClipboardList, Clock3, LayoutDashboard,
  ListTodo, Moon, Plus, Search, Sun, Trash2, Pencil, X, CalendarDays,
  AlertCircle, RotateCcw
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000/api/tasks";
const emptyForm = { title: "", description: "", priority: "Medium", dueDate: "" };

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [theme, setTheme] = useState(() => localStorage.getItem("taskflow-theme") || "light");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function request(path = "", options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "Something went wrong.");
    return data;
  }

  async function loadTasks() {
    setLoading(true);
    try {
      const data = await request();
      setTasks(Array.isArray(data) ? data : data.tasks || []);
      setError("");
    } catch {
      setError("Cannot connect to the server. Start the backend and check your database connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("taskflow-theme", theme);
  }, [theme]);

  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(
    (task) => !task.completed && task.dueDate &&
      new Date(task.dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)
  ).length;

  const visibleTasks = useMemo(() => {
    const result = tasks.filter((task) => {
      const matchesStatus =
        filter === "All" ||
        (filter === "Active" && !task.completed) ||
        (filter === "Completed" && task.completed);
      const matchesSearch = `${task.title} ${task.description || ""}`
        .toLowerCase().includes(search.toLowerCase());
      const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
      return matchesStatus && matchesSearch && matchesPriority;
    });

    return result.sort((a, b) => {
      if (sort === "dueDate") {
        return (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
          (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
      }
      return sort === "oldest"
        ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        : new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [tasks, filter, search, priorityFilter, sort]);

  function updateForm(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) return;

    const today = getLocalDateString();

    const originalTask = editingId
    ? tasks.find((task) => task._id === editingId)
    : null;

    const originalDueDate = originalTask?.dueDate
    ? String(originalTask.dueDate).slice(0, 10)
    : "";

    if (
      form.dueDate &&
      form.dueDate < today &&
      form.dueDate !== originalDueDate
    ) {
    setError("Due date cannot be in the past.");
    setNotice("");
    return;
  }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editingId) {
        const updated = await request(`/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ ...form, title: form.title.trim() }),
        });
        setTasks((current) => current.map((task) =>
          task._id === editingId ? updated : task
        ));
        setNotice("Task updated successfully.");
      } else {
        const created = await request("", {
          method: "POST",
          body: JSON.stringify({ ...form, title: form.title.trim() }),
        });
        setTasks((current) => [created, ...current]);
        setNotice("Task created successfully.");
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editTask(task) {
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "Medium",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
    });
    setEditingId(task._id);
    setNotice("");
    setError("");
    document.getElementById("task-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function toggleTask(task) {
    try {
      const updated = await request(`/${task._id}`, {
        method: "PUT",
        body: JSON.stringify({ completed: !task.completed }),
      });
      setTasks((current) => current.map((item) =>
        item._id === task._id ? updated : item
      ));
      setNotice(updated.completed ? "Task completed." : "Task marked as active.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTask(id) {
    if (!window.confirm("Delete this task permanently?")) return;

    try {
      await request(`/${id}`, { method: "DELETE" });
      setTasks((current) => current.filter((task) => task._id !== id));
      if (editingId === id) cancelEdit();
      setNotice("Task deleted successfully.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="TaskFlow home">
          <span className="brand-icon"><CheckCheck size={22} /></span>
          <span>TaskFlow<small>SMART TASK MANAGER</small></span>
        </a>

        <p className="nav-label">WORKSPACE</p>
        <button className="nav-item active" type="button">
          <LayoutDashboard size={18} /> Overview
        </button>
        <button className="nav-item" type="button" onClick={() => setFilter("All")}>
          <ListTodo size={18} /> All tasks <span className="nav-count">{tasks.length}</span>
        </button>
        <button className="nav-item" type="button" onClick={() => setFilter("Active")}>
          <Circle size={18} /> In progress <span className="nav-count">{pending}</span>
        </button>
        <button className="nav-item" type="button" onClick={() => setFilter("Completed")}>
          <CheckCircleIcon /> Completed
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon"><ClipboardList size={19} /></span>
            <strong>One task at a time.</strong>
            <p>Small steps lead to meaningful progress.</p>
          </div>
          <p className="sidebar-footer">TaskFlow · Stay focused</p>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>Task overview</h1>
            <p className="subtitle">Plan your work. Make progress. Get things done.</p>
          </div>
          <button
            className="theme-toggle icon-button"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title="Toggle theme"
          >
            {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </header>

        {error && (
          <div className="alert error-alert" role="alert">
            <AlertCircle size={18} /><span>{error}</span>
            <button className="alert-action" type="button" onClick={loadTasks}><RotateCcw size={15} /> Retry</button>
          </div>
        )}
        {notice && (
          <div className="alert success-alert" role="status">
            <Check size={17} /><span>{notice}</span>
            <button className="icon-button small-button" type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button>
          </div>
        )}

        <section className="stats-grid" aria-label="Task statistics">
          <StatCard icon={<ClipboardList />} label="Total tasks" value={tasks.length} detail="All your tasks" tone="blue" />
          <StatCard icon={<Clock3 />} label="In progress" value={pending} detail="Still to complete" tone="amber" />
          <StatCard icon={<CheckCircleIcon />} label="Completed" value={completed} detail="Tasks finished" tone="green" />
          <StatCard icon={<CalendarDays />} label="Overdue" value={overdue} detail="Past their due date" tone="rose" />
        </section>

        <section className="workspace-grid">
          <div className="task-panel">
            <div className="section-heading">
              <div>
                <h2>Your tasks</h2>
                <p>Keep track of what matters.</p>
              </div>
              <span className="result-count">{visibleTasks.length} shown</span>
            </div>

            <div className="toolbar">
              <label className="search-box">
                <Search size={17} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." aria-label="Search tasks" />
                {search && <button type="button" className="clear-search" onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}
              </label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filter by priority">
                <option value="All">All priorities</option>
                <option value="High">High priority</option>
                <option value="Medium">Medium priority</option>
                <option value="Low">Low priority</option>
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tasks">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="dueDate">Due date</option>
              </select>
            </div>

            <div className="filter-tabs" role="group" aria-label="Task status">
              {["All", "Active", "Completed"].map((item) => (
                <button key={item} type="button" className={filter === item ? "filter-tab selected" : "filter-tab"} onClick={() => setFilter(item)}>
                  {item}{item === "All" ? ` (${tasks.length})` : item === "Active" ? ` (${pending})` : ` (${completed})`}
                </button>
              ))}
            </div>

            <div className="task-list">
              {loading ? (
                <div className="empty-state"><span className="loader" /><p>Loading your tasks...</p></div>
              ) : visibleTasks.length ? visibleTasks.map((task) => (
                <article className={`task-card ${task.completed ? "task-done" : ""}`} key={task._id}>
                  <button
                    className={`complete-button ${task.completed ? "is-complete" : ""}`}
                    type="button"
                    onClick={() => toggleTask(task)}
                    aria-label={task.completed ? "Mark task active" : "Mark task completed"}
                    title={task.completed ? "Mark active" : "Complete task"}
                  >
                    {task.completed ? <Check size={17} /> : <Circle size={20} />}
                  </button>
                  <div className="task-details">
                    <h3>{task.title}</h3>
                    {task.description && <p className="task-description">{task.description}</p>}
                    <div className="task-meta">
                      <span className={`priority priority-${(task.priority || "Medium").toLowerCase()}`}>
                        <span /> {task.priority || "Medium"}
                      </span>
                      {task.dueDate && (
                        <span className="due-date"><CalendarDays size={13} /> {new Date(`${String(task.dueDate).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </div>
                  </div>
                  <div className="task-actions">
                    <button type="button" className="icon-button" onClick={() => editTask(task)} aria-label="Edit task" title="Edit"><Pencil size={16} /></button>
                    <button type="button" className="icon-button delete-button" onClick={() => deleteTask(task._id)} aria-label="Delete task" title="Delete"><Trash2 size={16} /></button>
                  </div>
                </article>
              )) : (
                <div className="empty-state">
                  <span className="empty-icon"><ClipboardList size={27} /></span>
                  <h3>{search || priorityFilter !== "All" ? "No matching tasks" : filter === "Completed" ? "Nothing completed yet" : "Your task list is clear"}</h3>
                  <p>{search || priorityFilter !== "All" ? "Try changing your search or filters." : "Add a task to start making progress."}</p>
                  {(search || priorityFilter !== "All") && <button className="text-button" type="button" onClick={() => { setSearch(""); setPriorityFilter("All"); }}>Clear filters</button>}
                </div>
              )}
            </div>
          </div>

          <aside className="form-panel" id="task-form">
            <div className="form-heading">
              <span className="form-icon">{editingId ? <Pencil size={20} /> : <Plus size={21} />}</span>
              <div>
                <h2>{editingId ? "Edit task" : "Create a task"}</h2>
                <p>{editingId ? "Update your task details." : "Add something to your list."}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="title">Task title <span>*</span></label>
              <input id="title" name="title" value={form.title} onChange={updateForm} placeholder="e.g. Prepare project demo" maxLength={120} required />

              <label className="field-label" htmlFor="description">Description <span className="optional">(optional)</span></label>
              <textarea id="description" name="description" value={form.description} onChange={updateForm} placeholder="Add a few details..." rows={3} maxLength={1000} />

              <label className="field-label" htmlFor="priority">Priority</label>
              <select id="priority" name="priority" value={form.priority} onChange={updateForm}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <label className="field-label" htmlFor="dueDate">Due date <span className="optional">(optional)</span></label>
              <input
                id="dueDate"
                type="date"
                name="dueDate"
                value={form.dueDate}
                min={getLocalDateString()}
                onChange={updateForm}
              />

              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? <><Check size={17} /> Save changes</> : <><Plus size={18} /> Add task</>}
              </button>
              {editingId && <button className="secondary-button" type="button" onClick={cancelEdit}>Cancel editing</button>}
            </form>
            <p className="form-footnote"><Check size={14} /> Your tasks are saved to the database.</p>
          </aside>
        </section>

        <footer className="app-footer">
          <span>TaskFlow</span><span>Built to help you focus on what matters.</span>
        </footer>
      </section>
    </main>
  );
}

function CheckCircleIcon({ size = 18 }) {
  return <CheckCheck size={size} />;
}

function StatCard({ icon, label, value, detail, tone }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-copy"><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>
    </article>
  );
}

export default App;
