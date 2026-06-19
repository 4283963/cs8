<script setup>
import { ref, computed, onMounted } from 'vue';
import { fetchTasks, moveTask } from './api.js';
import KanbanColumn from './components/KanbanColumn.vue';

const columns = [
  { id: 'todo', title: '待处理', accent: '#64748b' },
  { id: 'in-progress', title: '进行中', accent: '#3b82f6' },
  { id: 'done', title: '已完成', accent: '#22c55e' },
];

const tasks = ref([]);
const loading = ref(true);
const errorMsg = ref('');
const savingId = ref(null);

onMounted(async () => {
  try {
    tasks.value = await fetchTasks();
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    loading.value = false;
  }
});

const tasksByStatus = computed(() => {
  const map = { todo: [], 'in-progress': [], done: [] };
  for (const task of tasks.value) {
    if (map[task.status]) map[task.status].push(task);
  }
  return map;
});

const total = computed(() => tasks.value.length);

async function handleMove(taskId, newStatus) {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task || task.status === newStatus) return;

  const previousStatus = task.status;
  task.status = newStatus;
  savingId.value = taskId;
  errorMsg.value = '';

  try {
    await moveTask(taskId, newStatus);
  } catch (err) {
    task.status = previousStatus;
    errorMsg.value = `同步失败：${err.message}（已回滚）`;
  } finally {
    savingId.value = null;
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
        <span v-if="savingId" class="stat stat--sync">同步中…</span>
      </div>
    </header>

    <div v-if="errorMsg" class="app__error">⚠️ {{ errorMsg }}</div>

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

.app__error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 16px;
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

@media (max-width: 760px) {
  .app__board {
    flex-direction: column;
  }
  .kanban-column {
    width: 100%;
  }
}
</style>
