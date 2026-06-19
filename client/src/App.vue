<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { fetchTasks, fetchHistory, moveTask } from './api.js';
import KanbanColumn from './components/KanbanColumn.vue';

const columns = [
  { id: 'todo', title: '待处理', accent: '#64748b' },
  { id: 'in-progress', title: '进行中', accent: '#3b82f6' },
  { id: 'done', title: '已完成', accent: '#22c55e' },
];

const tasks = ref([]);
const history = ref([]);
const loading = ref(true);
const errorMsg = ref('');
const savingId = ref(null);
const toast = ref('');

const summaryModalVisible = ref(false);
const summaryTask = ref(null);
const summaryNewOrder = ref(0);
const summaryInput = ref('');
const summarySubmitting = ref(false);
const summaryTextareaRef = ref(null);

const historyOpen = ref(false);

let toastTimer = null;
function showToast(msg) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 3000);
}

onMounted(async () => {
  try {
    [tasks.value, history.value] = await Promise.all([fetchTasks(), fetchHistory()]);
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    loading.value = false;
  }
});

watch(
  summaryModalVisible,
  async (visible) => {
    if (visible && summaryTextareaRef.value) {
      await nextTick();
      summaryTextareaRef.value.focus();
    }
  },
);

const tasksByStatus = computed(() => {
  const map = { todo: [], 'in-progress': [], done: [] };
  for (const task of tasks.value) {
    if (map[task.status]) map[task.status].push(task);
  }
  for (const status of Object.keys(map)) {
    map[status].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return map;
});

const total = computed(() => tasks.value.length);

const orderBy = (a, b) => (a.order ?? 0) - (b.order ?? 0);

function applyMoveLocal(taskId, newStatus, newOrder, extra) {
  const lists = { todo: [], 'in-progress': [], done: [], archived: [] };
  let moved = null;
  for (const t of tasks.value) {
    if (t.id === taskId) {
      moved = t;
      continue;
    }
    if (lists[t.status]) lists[t.status].push(t);
  }
  for (const status of ['todo', 'in-progress', 'done']) lists[status].sort(orderBy);

  const isArchived = newStatus === 'archived';
  if (isArchived) {
    lists.archived.push(moved);
  } else {
    const target = lists[newStatus];
    const clamped = Math.max(0, Math.min(newOrder, target.length));
    target.splice(clamped, 0, moved);
  }

  moved.status = newStatus;
  moved.updatedAt = new Date().toISOString();
  if (extra) Object.assign(moved, extra);

  for (const status of ['todo', 'in-progress', 'done']) {
    lists[status].forEach((t, i) => {
      t.order = i;
    });
  }
  tasks.value = [...lists.todo, ...lists['in-progress'], ...lists.done];

  if (isArchived) {
    history.value = [moved, ...history.value].filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
    );
  }
}

async function handleMove(taskId, newStatus, insertIndex) {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return;

  let newOrder = insertIndex;
  if (task.status === newStatus) {
    const list = tasksByStatus.value[newStatus];
    const draggedIndex = list.findIndex((t) => t.id === taskId);
    if (draggedIndex !== -1 && newOrder > draggedIndex) newOrder -= 1;
  }
  if (task.status === newStatus && task.order === newOrder) return;

  if (task.status === 'in-progress' && newStatus === 'done') {
    summaryTask.value = task;
    summaryNewOrder.value = newOrder;
    summaryInput.value = '';
    summarySubmitting.value = false;
    summaryModalVisible.value = true;
    return;
  }

  await submitMove(taskId, newStatus, newOrder);
}

async function submitMove(taskId, newStatus, newOrder, summary) {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return;

  const snapshot = tasks.value.map((t) => ({ ...t }));
  const willArchive = summary !== undefined;
  const finalStatus = willArchive ? 'archived' : newStatus;
  applyMoveLocal(
    taskId,
    finalStatus,
    newOrder,
    willArchive
      ? { completionSummary: summary.trim() || '（未填写完成总结）', archivedAt: new Date().toISOString() }
      : null,
  );
  savingId.value = taskId;
  errorMsg.value = '';

  try {
    const data = await moveTask(taskId, newStatus, newOrder, summary);
    if (Array.isArray(data.tasks)) tasks.value = data.tasks;
    if (data.archived) {
      showToast(`已归档「${task.title}」，可在历史菜单中查看`);
      const refreshedHistory = await fetchHistory().catch(() => history.value);
      if (Array.isArray(refreshedHistory)) history.value = refreshedHistory;
    }
  } catch (err) {
    tasks.value = snapshot;
    if (willArchive) {
      history.value = history.value.filter((x) => x.id !== taskId);
    }
    errorMsg.value = `同步失败：${err.message}（已回滚）`;
  } finally {
    savingId.value = null;
  }
}

async function confirmSummary() {
  if (summarySubmitting.value) return;
  const task = summaryTask.value;
  if (!task) return;
  summarySubmitting.value = true;
  const newOrder = summaryNewOrder.value;
  const summary = summaryInput.value;
  summaryModalVisible.value = false;
  await submitMove(task.id, 'done', newOrder, summary);
  summaryTask.value = null;
  summarySubmitting.value = false;
}

function cancelSummary() {
  if (summarySubmitting.value) return;
  summaryModalVisible.value = false;
  summaryTask.value = null;
  summaryInput.value = '';
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

async function openHistory() {
  historyOpen.value = true;
  try {
    history.value = await fetchHistory();
  } catch (_) {
    // 忽略
  }
}
</script>

<template>
  <div class="app">
    <header class="app__header">
      <div class="app__brand">
        <div class="app__logo">KB</div>
        <div>
          <h1 class="app__title">敏捷看板</h1>
          <p class="app__subtitle">研发团队任务协作 · 拖拽即可更新状态</p>
        </div>
      </div>
      <div class="app__stats">
        <span class="stat"><strong>{{ total }}</strong> 任务</span>
        <button class="btn-history" type="button" @click="openHistory">
          <span class="btn-history__icon">⏱</span>
          <span>历史</span>
          <span v-if="history.length" class="btn-history__count">{{ history.length }}</span>
        </button>
        <span v-if="savingId" class="stat stat--sync">同步中…</span>
      </div>
    </header>

    <div v-if="errorMsg" class="app__error">⚠️ {{ errorMsg }}</div>
    <div v-if="toast" class="app__toast">✅ {{ toast }}</div>

    <div v-if="loading" class="app__loading">加载任务中…</div>

    <main v-else class="app__board">
      <KanbanColumn
        v-for="column in columns"
        :key="column.id"
        :column="column"
        :tasks="tasksByStatus[column.id]"
        @move="handleMove"
      />
    </main>

    <footer class="app__footer">
      使用 Vue3 + 原生 HTML5 Drag and Drop API · 后端 Node.js (Express)
    </footer>

    <div
      v-if="summaryModalVisible"
      class="modal-mask"
      @click.self="cancelSummary"
    >
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <header class="modal__header">
          <div class="modal__badge">完成归档</div>
          <button class="modal__close" type="button" aria-label="取消" @click="cancelSummary">
            ×
          </button>
        </header>
        <h3 id="summary-title" class="modal__title">
          完成任务：「{{ summaryTask?.title }}」
        </h3>
        <p class="modal__desc">
          写下本次任务的完成总结，确认后任务将被移入历史菜单。
        </p>
        <textarea
          ref="summaryTextareaRef"
          v-model="summaryInput"
          class="modal__textarea"
          rows="4"
          placeholder="例如：通过回归测试并合并到 main 分支，CI 构建通过，产品验收已完成…"
          :disabled="summarySubmitting"
          @keydown.enter.ctrl.prevent="confirmSummary"
        />
        <footer class="modal__footer">
          <button
            type="button"
            class="btn btn--ghost"
            @click="cancelSummary"
            :disabled="summarySubmitting"
          >
            取消
          </button>
          <button
            type="button"
            class="btn btn--primary"
            @click="confirmSummary"
            :disabled="summarySubmitting"
          >
            {{ summarySubmitting ? '归档中…' : '确认并归档' }}
          </button>
        </footer>
      </div>
    </div>

    <div
      class="drawer-mask"
      :class="{ 'is-open': historyOpen }"
      @click.self="historyOpen = false"
    >
      <aside class="drawer" :class="{ 'is-open': historyOpen }">
        <header class="drawer__header">
          <div>
            <h3 class="drawer__title">历史任务</h3>
            <p class="drawer__subtitle">
              共 <strong>{{ history.length }}</strong> 条已归档记录，按归档时间倒序
            </p>
          </div>
          <button type="button" class="drawer__close" aria-label="关闭" @click="historyOpen = false">
            ×
          </button>
        </header>
        <div class="drawer__body">
          <div v-if="history.length === 0" class="drawer__empty">
            暂无归档记录 · 从「进行中」拖到「已完成」即可归档
          </div>
          <article v-for="item in history" :key="item.id" class="history-item">
            <div class="history-item__top">
              <h4 class="history-item__title">{{ item.title }}</h4>
              <span class="history-item__id">{{ item.id }}</span>
            </div>
            <p v-if="item.description" class="history-item__desc">{{ item.description }}</p>
            <div class="history-item__summary">
              <div class="history-item__summary-label">完成总结</div>
              <p class="history-item__summary-text">
                {{ item.completionSummary || '（未填写完成总结）' }}
              </p>
            </div>
            <div class="history-item__meta">
              <span v-if="item.assignee" class="chip">{{ item.assignee }}</span>
              <span v-if="item.archivedAt" class="chip chip--muted">
                归档于 {{ formatDate(item.archivedAt) }}
              </span>
            </div>
          </article>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 24px 40px;
}

.app__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
  flex-wrap: wrap;
  gap: 12px;
}

.app__brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app__logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}

.app__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.app__subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
}

.app__stats {
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat {
  font-size: 13px;
  color: #64748b;
}

.stat strong {
  color: #0f172a;
  font-size: 16px;
}

.stat--sync {
  color: #6366f1;
}

.btn-history {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-history:hover {
  border-color: #6366f1;
  color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
}

.btn-history__icon {
  font-size: 14px;
}

.btn-history__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 0 6px;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}

.app__error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 16px;
}

.app__toast {
  position: fixed;
  top: 22px;
  right: 24px;
  z-index: 200;
  background: #0f172a;
  color: #ffffff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
  animation: toast-in 0.2s ease-out;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app__loading {
  text-align: center;
  color: #64748b;
  padding: 60px 0;
  font-size: 14px;
}

.app__board {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.app__footer {
  margin-top: 28px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

/* Modal */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: mask-in 0.15s ease-out;
}

@keyframes mask-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  padding: 20px 24px 22px;
  animation: modal-in 0.18s ease-out;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.modal__badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #22c55e, #10b981);
  color: #ffffff;
}

.modal__close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #f1f5f9;
  color: #475569;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s ease;
}

.modal__close:hover {
  background: #e2e8f0;
}

.modal__title {
  margin: 6px 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.modal__desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.55;
}

.modal__textarea {
  width: 100%;
  resize: vertical;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;
  color: #0f172a;
  background: #f8fafc;
  transition: border-color 0.12s ease, background 0.12s ease;
  outline: none;
}

.modal__textarea:focus {
  border-color: #6366f1;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.modal__textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.btn {
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--ghost {
  background: #f1f5f9;
  color: #475569;
}

.btn--ghost:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn--primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.btn--primary:hover:not(:disabled) {
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
  transform: translateY(-1px);
}

/* Drawer */
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 90;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.drawer-mask.is-open {
  opacity: 1;
  pointer-events: auto;
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  height: 100vh;
  width: min(480px, 92vw);
  background: #ffffff;
  box-shadow: -16px 0 40px rgba(15, 23, 42, 0.15);
  transform: translateX(100%);
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;
}

.drawer.is-open {
  transform: translateX(0);
}

.drawer__header {
  padding: 20px 22px 16px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.drawer__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.drawer__subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
}

.drawer__subtitle strong {
  color: #334155;
}

.drawer__close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #f1f5f9;
  color: #475569;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.drawer__close:hover {
  background: #e2e8f0;
}

.drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 22px 28px;
}

.drawer__empty {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 60px 0;
  line-height: 1.7;
}

.history-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}

.history-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.history-item__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.history-item__id {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #94a3b8;
}

.history-item__desc {
  margin: 0 0 10px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.history-item__summary {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

.history-item__summary-label {
  font-size: 11px;
  font-weight: 700;
  color: #6366f1;
  margin-bottom: 4px;
  letter-spacing: 0.04em;
}

.history-item__summary-text {
  margin: 0;
  font-size: 13px;
  color: #334155;
  line-height: 1.55;
  white-space: pre-wrap;
}

.history-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-block;
  font-size: 12px;
  padding: 2px 9px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 600;
}

.chip--muted {
  background: #f1f5f9;
  color: #64748b;
  font-weight: 500;
}

@media (max-width: 760px) {
  .app__board {
    flex-direction: column;
  }
  .kanban-column {
    width: 100%;
  }
}
</style>
