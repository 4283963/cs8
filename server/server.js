import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const VALID_STATUSES = ['todo', 'in-progress', 'done', 'archived'];
const VISIBLE_STATUSES = ['todo', 'in-progress', 'done'];

const app = express();
app.use(cors());
app.use(express.json());

let tasks = [];

async function loadTasks() {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    tasks = JSON.parse(raw);
    normalizeOrders();
  } catch (err) {
    console.error('读取任务数据失败，使用空数组初始化：', err.message);
    tasks = [];
  }
}

async function persist() {
  await writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

const orderBy = (a, b) => (a.order ?? 0) - (b.order ?? 0);

function normalizeOrders() {
  const lists = { todo: [], 'in-progress': [], done: [], archived: [] };
  for (const t of tasks) if (lists[t.status]) lists[t.status].push(t);
  for (const status of VISIBLE_STATUSES) {
    lists[status].sort(orderBy);
    lists[status].forEach((t, i) => {
      t.order = i;
    });
  }
  tasks = [...lists.todo, ...lists['in-progress'], ...lists.done, ...lists.archived];
}

function applyMove(taskId, newStatus, newOrder) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const previousStatus = task.status;
  const lists = { todo: [], 'in-progress': [], done: [], archived: [] };
  for (const t of tasks) {
    if (t.id === taskId) continue;
    if (lists[t.status]) lists[t.status].push(t);
  }
  for (const status of VISIBLE_STATUSES) lists[status].sort(orderBy);

  if (newStatus === 'archived') {
    lists.archived.push(task);
  } else {
    const target = lists[newStatus];
    const clamped = Math.max(0, Math.min(newOrder, target.length));
    target.splice(clamped, 0, task);
  }

  task.status = newStatus;
  task.updatedAt = new Date().toISOString();

  for (const status of VISIBLE_STATUSES) {
    lists[status].forEach((t, i) => {
      t.order = i;
    });
  }
  tasks = [...lists.todo, ...lists['in-progress'], ...lists.done, ...lists.archived];

  return { previousStatus };
}

app.get('/api/tasks', (_req, res) => {
  res.json(tasks.filter((t) => t.status !== 'archived'));
});

app.get('/api/tasks/history', (_req, res) => {
  const history = tasks
    .filter((t) => t.status === 'archived')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  res.json(history);
});

app.post('/api/task/move', async (req, res) => {
  const { taskId, newStatus, newOrder, summary } = req.body ?? {};

  if (!taskId || !newStatus) {
    return res.status(400).json({ error: 'taskId 和 newStatus 为必填项' });
  }
  if (!VALID_STATUSES.includes(newStatus)) {
    return res
      .status(400)
      .json({ error: `newStatus 无效，可选值：${VALID_STATUSES.join(', ')}` });
  }

  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: `找不到任务：${taskId}` });
  }

  const previousStatus = task.status;
  const needsSummary = previousStatus === 'in-progress' && newStatus === 'done';
  const finalStatus = needsSummary ? 'archived' : newStatus;

  const parsedOrder = Number(newOrder);
  const resolvedOrder = Number.isFinite(parsedOrder) ? parsedOrder : Infinity;
  const snapshot = tasks.map((t) => ({ ...t }));

  const result = applyMove(taskId, finalStatus, resolvedOrder);

  if (needsSummary) {
    task.completionSummary =
      typeof summary === 'string' && summary.trim().length > 0 ? summary.trim() : '（未填写完成总结）';
    task.archivedAt = task.updatedAt;
  }

  try {
    await persist();
  } catch (err) {
    tasks = snapshot;
    return res.status(500).json({ error: '数据持久化失败', detail: err.message });
  }

  res.json({
    success: true,
    task: tasks.find((t) => t.id === taskId),
    previousStatus,
    finalStatus,
    archived: finalStatus === 'archived',
    tasks: tasks.filter((t) => t.status !== 'archived'),
  });
});

const PORT = process.env.PORT || 3000;

loadTasks().then(() => {
  app.listen(PORT, () => {
    console.log(`看板服务已启动：http://localhost:${PORT}`);
    console.log(`  GET  /api/tasks            获取可见任务（过滤已归档）`);
    console.log(`  GET  /api/tasks/history    获取已归档的历史任务`);
    console.log(`  POST /api/task/move        移动任务（进行中→已完成=归档）`);
  });
});
