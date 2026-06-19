const API_BASE = '/api';

export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/tasks`);
  if (!res.ok) {
    throw new Error(`获取任务失败 (${res.status})`);
  }
  return res.json();
}

export async function fetchHistory() {
  const res = await fetch(`${API_BASE}/tasks/history`);
  if (!res.ok) {
    throw new Error(`获取历史任务失败 (${res.status})`);
  }
  return res.json();
}

export async function moveTask(taskId, newStatus, newOrder, summary) {
  const payload = { taskId, newStatus, newOrder };
  if (summary !== undefined) payload.summary = summary;
  const res = await fetch(`${API_BASE}/task/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `移动任务失败 (${res.status})`);
  }
  return res.json();
}
