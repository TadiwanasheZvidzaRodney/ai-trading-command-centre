import {
  randomId,
  type InstrumentSymbol,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@atc/shared';
import type { Collection, Db } from 'mongodb';

export interface TaskCreateInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  instrument?: InstrumentSymbol | null;
}

export interface TaskUpdateInput {
  title?: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  instrument?: InstrumentSymbol | null;
}

export interface TaskStore {
  list(): Promise<Task[]>;
  create(input: TaskCreateInput): Promise<Task>;
  update(id: string, input: TaskUpdateInput): Promise<Task | null>;
  remove(id: string): Promise<boolean>;
}

interface TaskDocument {
  _id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  instrument: InstrumentSymbol | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
};

function toTask(document: TaskDocument): Task {
  return {
    id: document._id,
    title: document.title,
    notes: document.notes,
    status: document.status,
    priority: document.priority,
    dueAt: document.dueAt,
    instrument: document.instrument,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    completedAt: document.completedAt,
  };
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const status = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (status !== 0) return status;
    if (left.dueAt && right.dueAt) {
      return left.dueAt.localeCompare(right.dueAt);
    }
    if (left.dueAt) return -1;
    if (right.dueAt) return 1;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export class MongoTaskStore implements TaskStore {
  private readonly db: Db | null;

  constructor(db: Db | null) {
    this.db = db;
  }

  private get collection(): Collection<TaskDocument> {
    if (!this.db) throw new Error('MongoDB is not connected');
    return this.db.collection<TaskDocument>('tasks');
  }

  async list(): Promise<Task[]> {
    const documents = await this.collection.find({}).toArray();
    return sortTasks(documents.map(toTask));
  }

  async create(input: TaskCreateInput): Promise<Task> {
    const now = new Date().toISOString();
    const status = input.status ?? 'todo';
    const document: TaskDocument = {
      _id: randomId('tsk_'),
      title: input.title,
      notes: input.notes ?? '',
      status,
      priority: input.priority ?? 'medium',
      dueAt: input.dueAt ?? null,
      instrument: input.instrument ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : null,
    };
    await this.collection.insertOne(document);
    return toTask(document);
  }

  async update(id: string, input: TaskUpdateInput): Promise<Task | null> {
    const existing = await this.collection.findOne({ _id: id });
    if (!existing) return null;

    const now = new Date().toISOString();
    const status = input.status ?? existing.status;
    const completedAt =
      status === 'done'
        ? existing.status === 'done'
          ? existing.completedAt
          : now
        : null;

    const document: TaskDocument = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      ...(input.instrument !== undefined ? { instrument: input.instrument } : {}),
      status,
      updatedAt: now,
      completedAt,
    };

    await this.collection.replaceOne({ _id: id }, document);
    return toTask(document);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}
