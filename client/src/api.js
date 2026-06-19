const API_BASE = '/api';

export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) {
    throw new Error(`获取任务失败 (${res.status})`);
  }
  return res.json();
}

export async function moveTask(taskId, newStatus) {
  const res = await fetch(`${API_BASE}/task/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, newStatus }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `移动任务失败 (${res.status})`);
  }
  return res.json();
}
