import express from 'express';
import cors from 'cors';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

const VALID_STATUSES = ['todo', 'in-progress', 'done'];

const app = express();
app.use(cors());
app.use(express.json());

let tasks = [];

async function loadTasks() {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    tasks = JSON.parse(raw);
  } catch (err) {
    console.error('读取任务数据失败，使用空数组初始化：', err.message);
    tasks = [];
  }
}

async function persist() {
  await writeFile(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

app.get('/api/tasks', (_req, res) => {
  res.json(tasks);
});

app.post('/api/task/move', async (req, res) => {
  const { taskId, newStatus } = req.body ?? {};

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
  if (previousStatus === newStatus) {
    return res.json({ success: true, task, previousStatus, message: '状态未变化' });
  }

  task.status = newStatus;
  task.updatedAt = new Date().toISOString();

  try {
    await persist();
  } catch (err) {
    task.status = previousStatus;
    return res.status(500).json({ error: '数据持久化失败', detail: err.message });
  }

  res.json({ success: true, task, previousStatus });
});

const PORT = process.env.PORT || 3000;

loadTasks().then(() => {
  app.listen(PORT, () => {
    console.log(`看板服务已启动：http://localhost:${PORT}`);
    console.log(`  GET  /api/tasks        获取全部任务`);
    console.log(`  POST /api/task/move    移动任务到新状态`);
  });
});
