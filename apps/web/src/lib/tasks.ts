import type { InstrumentSymbol, Task, TaskPriority, TaskStatus } from '@atc/shared';
import { api } from './api';

export interface TaskInput {
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  instrument?: InstrumentSymbol | null;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const response = await api.post<{ task: Task }>('/api/v1/tasks', input);
  return response.task;
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  const response = await api.patch<{ task: Task }>(`/api/v1/tasks/${id}`, input);
  return response.task;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete<null>(`/api/v1/tasks/${id}`);
}
