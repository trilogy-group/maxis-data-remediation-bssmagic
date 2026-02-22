export type TmfTaskState =
  | 'acknowledged'
  | 'inProgress'
  | 'done'
  | 'terminatedWithError';

export type TmfTaskRelatedEntity = {
  id: string;
  role?: string;
  '@referredType'?: string;
};

export type TmfTask = {
  id: string;
  href: string;
  '@type': string;
  name?: string;
  state: TmfTaskState;
  creationDate: string;
  lastUpdate: string;
  relatedEntity?: TmfTaskRelatedEntity[];
  characteristic?: Array<{ name: string; value: string }>;
  note?: Array<{ text: string; date?: string }>;
};

declare global {
  // eslint-disable-next-line no-var
  var __BSSMAGIC_TASKS__: Map<string, TmfTask> | undefined;
}

function getStore(): Map<string, TmfTask> {
  if (!globalThis.__BSSMAGIC_TASKS__) globalThis.__BSSMAGIC_TASKS__ = new Map();
  return globalThis.__BSSMAGIC_TASKS__;
}

export function createTask(task: TmfTask) {
  getStore().set(task.id, task);
  return task;
}

export function getTask(id: string) {
  return getStore().get(id);
}

export function updateTask(id: string, patch: Partial<TmfTask>) {
  const existing = getStore().get(id);
  if (!existing) return null;
  const next: TmfTask = {
    ...existing,
    ...patch,
    lastUpdate: new Date().toISOString(),
  };
  getStore().set(id, next);
  return next;
}









