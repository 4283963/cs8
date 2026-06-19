<script setup>
import { ref, computed } from 'vue';
import TaskCard from './TaskCard.vue';

const props = defineProps({
  column: { type: Object, required: true },
  tasks: { type: Array, default: () => [] },
});

const emit = defineEmits(['move']);

const dragCounter = ref(0);
const isDragOver = computed(() => dragCounter.value > 0);
const dropIndex = ref(null);

function onDragEnter(event) {
  event.preventDefault();
  dragCounter.value += 1;
}

function onDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  if (dropIndex.value === null) dropIndex.value = props.tasks.length;
}

function onDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    dragCounter.value = Math.max(0, dragCounter.value - 1);
    if (dragCounter.value === 0) dropIndex.value = null;
  }
}

function onCardDragOver(event, index) {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const isUpperHalf = event.clientY < rect.top + rect.height / 2;
  dropIndex.value = isUpperHalf ? index : index + 1;
}

function onDrop(event) {
  event.preventDefault();
  const insertIndex = dropIndex.value ?? props.tasks.length;
  dragCounter.value = 0;
  dropIndex.value = null;
  const taskId = event.dataTransfer?.getData('text/plain');
  if (taskId) {
    emit('move', taskId, props.column.id, insertIndex);
  }
}
</script>

<template>
  <section
    class="kanban-column"
    :class="{ 'is-drag-over': isDragOver }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header class="kanban-column__header" :style="{ '--accent': column.accent }">
      <span class="kanban-column__dot" />
      <h3 class="kanban-column__title">{{ column.title }}</h3>
      <span class="kanban-column__count">{{ tasks.length }}</span>
    </header>

    <div class="kanban-column__body">
      <template v-for="(task, index) in tasks" :key="task.id">
        <div
          v-if="isDragOver && dropIndex === index"
          class="drop-indicator"
        />
        <div
          class="kanban-column__card-wrapper"
          @dragover="onCardDragOver($event, index)"
        >
          <TaskCard :task="task" />
        </div>
      </template>

      <div
        v-if="isDragOver && dropIndex === tasks.length"
        class="drop-indicator"
      />

      <div v-if="tasks.length === 0 && !isDragOver" class="kanban-column__empty">
        <span>拖拽任务卡片到此处</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.kanban-column {
  display: flex;
  flex-direction: column;
  min-width: 300px;
  width: 320px;
  background: #f1f5f9;
  border: 2px dashed transparent;
  border-radius: 14px;
  padding: 12px;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.kanban-column.is-drag-over {
  background: #e0e7ff;
  border-color: #6366f1;
}

.kanban-column__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 12px;
}

.kanban-column__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent, #64748b);
}

.kanban-column__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}

.kanban-column__count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  background: #ffffff;
  border-radius: 999px;
  padding: 1px 9px;
  min-width: 22px;
  text-align: center;
}

.kanban-column__body {
  flex: 1;
  min-height: 80px;
  display: flex;
  flex-direction: column;
}

.kanban-column__card-wrapper {
  display: block;
}

.drop-indicator {
  height: 4px;
  margin: 4px 2px;
  border-radius: 999px;
  background: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  animation: drop-pulse 1s ease-in-out infinite;
}

@keyframes drop-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

.kanban-column__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  border-radius: 10px;
  border: 1px dashed #cbd5e1;
  min-height: 80px;
}
</style>
