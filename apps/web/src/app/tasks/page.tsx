'use client';

import type { InstrumentSymbol, Task, TaskPriority, TaskStatus } from '@atc/shared';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ListChecks,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTasks } from '@/lib/hooks';
import { createTask, deleteTask, updateTask } from '@/lib/tasks';

const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];
const INSTRUMENTS: readonly InstrumentSymbol[] = ['XAU/USD', 'EUR/USD', 'GBP/USD'];

function toIsoFromLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isOverdue(task: Task): boolean {
  if (!task.dueAt || task.status === 'done') return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

function TaskRow({
  task,
  busy,
  onToggle,
  onStatus,
  onDelete,
}: {
  task: Task;
  busy: boolean;
  onToggle: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onDelete: (task: Task) => void;
}) {
  const due = formatDue(task.dueAt);
  const overdue = isOverdue(task);
  return (
    <div className={`task-row ${task.status === 'done' ? 'done' : ''} ${overdue ? 'overdue' : ''}`}>
      <button
        type="button"
        className="task-check"
        aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={() => onToggle(task)}
        disabled={busy}
      >
        <Check size={12} />
      </button>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
        <div className="task-meta">
          <span className={`priority-${task.priority}`}>
            {task.priority.toUpperCase()} priority
          </span>
          {task.instrument && <span className="badge">{task.instrument}</span>}
          <span className={`badge ${task.status === 'done' ? 'ok' : task.status === 'in_progress' ? 'info' : ''}`}>
            {task.status.replace('_', ' ')}
          </span>
          {due && (
            <span className={overdue ? 'overdue-text' : undefined}>
              <CalendarClock size={10} /> {overdue ? 'Overdue · ' : 'Due '}
              {due}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        {task.status !== 'done' && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() =>
              onStatus(task, task.status === 'in_progress' ? 'todo' : 'in_progress')
            }
            disabled={busy}
          >
            {task.status === 'in_progress' ? <Pause size={12} /> : <Play size={12} />}
            {task.status === 'in_progress' ? 'Pause' : 'Start'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => onDelete(task)}
          disabled={busy}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const tasks = useTasks();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [instrument, setInstrument] = useState<'' | InstrumentSymbol>('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useMemo(() => tasks.data?.tasks ?? [], [tasks.data]);
  const open = useMemo(() => list.filter((task) => task.status !== 'done'), [list]);
  const done = useMemo(() => list.filter((task) => task.status === 'done'), [list]);
  const overdue = open.filter(isOverdue).length;
  const inProgress = open.filter((task) => task.status === 'in_progress').length;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setFormError('A title is required.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await createTask({
        title: title.trim(),
        notes: notes.trim(),
        priority,
        instrument: instrument || null,
        dueAt: toIsoFromLocal(dueAt),
      });
      setTitle('');
      setNotes('');
      setPriority('medium');
      setInstrument('');
      setDueAt('');
      await tasks.mutate();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create the task.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(task: Task) {
    setBusy(true);
    setActionError(null);
    try {
      await updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' });
      await tasks.mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the task.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(task: Task, status: TaskStatus) {
    setBusy(true);
    setActionError(null);
    try {
      await updateTask(task.id, { status });
      await tasks.mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the task.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(task: Task) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteTask(task.id);
      await tasks.mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete the task.');
    } finally {
      setBusy(false);
    }
  }

  const error = tasks.error ?? actionError;

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="pill accent">Phase 3 · Trading workspace</span>
          <h2>Preparation tasks and reminders.</h2>
          <p>
            Track pre-trade checks, news reviews and end-of-day tasks. Tasks are stored in
            MongoDB and tied to an optional instrument. Due times are entered locally and
            stored as UTC.
          </p>
        </div>
        <div className="hero-badges">
          <span className="badge ok">
            <ListChecks size={12} /> Persistent
          </span>
          <span className="badge">Single user</span>
        </div>
      </section>

      {error && (
        <div className="banner error">
          <AlertTriangle size={16} />
          <span>{error instanceof Error ? error.message : String(error)}</span>
        </div>
      )}

      <div className="task-stats">
        <div className="task-stat">
          <div className="task-stat-label">Open</div>
          <div className="task-stat-value">{open.length}</div>
        </div>
        <div className="task-stat">
          <div className="task-stat-label">In progress</div>
          <div className="task-stat-value">{inProgress}</div>
        </div>
        <div className="task-stat">
          <div className="task-stat-label">Overdue</div>
          <div className={`task-stat-value ${overdue > 0 ? 'negative' : ''}`}>{overdue}</div>
        </div>
        <div className="task-stat">
          <div className="task-stat-label">Completed</div>
          <div className="task-stat-value">{done.length}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">New task</h3>
            <span className="hint">No placeholder tasks are created automatically.</span>
          </div>
          <span className="badge">MongoDB</span>
        </div>
        <div className="card-body">
          <form className="task-form" onSubmit={handleCreate}>
            <div className="field field-wide">
              <label className="label" htmlFor="task-title">
                Title
              </label>
              <input
                id="task-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Review XAU/USD around the US session open"
                maxLength={300}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                className="select"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="task-instrument">
                Instrument
              </label>
              <select
                id="task-instrument"
                className="select"
                value={instrument}
                onChange={(event) =>
                  setInstrument(event.target.value as '' | InstrumentSymbol)
                }
              >
                <option value="">Any</option>
                {INSTRUMENTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="task-due">
                Due (local time)
              </label>
              <input
                id="task-due"
                className="input"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div className="field field-wide">
              <label className="label" htmlFor="task-notes">
                Notes
              </label>
              <textarea
                id="task-notes"
                className="textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context, checks or invalidation notes."
                maxLength={4000}
              />
            </div>
            {formError && <p className="error-text field-wide">{formError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <Plus size={14} /> {busy ? 'Saving…' : 'Add task'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Task list</h3>
            <span className="hint">Open tasks first, then completed</span>
          </div>
          <span className="badge">{list.length}</span>
        </div>
        <div className="card-body">
          {tasks.isLoading && list.length === 0 ? (
            <div className="loading">
              <span className="spinner" /> Loading tasks…
            </div>
          ) : list.length === 0 ? (
            <div className="empty-state task-empty">
              <ListChecks size={26} />
              <h3>No tasks yet</h3>
              <p>Add a preparation task above. Nothing is fabricated or pre-seeded.</p>
            </div>
          ) : (
            <>
              <div className="task-group">
                <div className="task-group-title">
                  Open <span className="badge">{open.length}</span>
                </div>
                {open.length === 0 ? (
                  <p className="hint">No open tasks. Completed work is listed below.</p>
                ) : (
                  open.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      busy={busy}
                      onToggle={handleToggle}
                      onStatus={handleStatus}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
              <div className="task-group">
                <div className="task-group-title">
                  Completed <span className="badge">{done.length}</span>
                </div>
                {done.length === 0 ? (
                  <p className="hint">Nothing completed yet.</p>
                ) : (
                  done.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      busy={busy}
                      onToggle={handleToggle}
                      onStatus={handleStatus}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
