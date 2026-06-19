<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  task: { type: Object, required: true },
});

const emit = defineEmits(['dragstart', 'dragend']);

const isDragging = ref(false);

const priorityMeta = {
  high: { label: '高', class: 'priority-high' },
  medium: { label: '中', class: 'priority-medium' },
  low: { label: '低', class: 'priority-low' },
};

const priority = computed(() => priorityMeta[props.task.priority] ?? priorityMeta.medium);

const initials = computed(() => (props.task.assignee || '?').slice(0, 1).toUpperCase());

function onDragStart(event) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', props.task.id);
  }
  isDragging.value = true;
  emit('dragstart', props.task.id);
}

function onDragEnd() {
  isDragging.value = false;
  emit('dragend', props.task.id);
}
</script>

<template>
  <article
    class="task-card"
    :class="{ 'is-dragging': isDragging }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="task-card__top">
      <span class="priority" :class="priority.class">{{ priority.label }}</span>
      <span class="task-card__id">{{ task.id }}</span>
    </div>

    <h4 class="task-card__title">{{ task.title }}</h4>
    <p v-if="task.description" class="task-card__desc">{{ task.description }}</p>

    <div v-if="task.tags?.length" class="task-card__tags">
      <span v-for="tag in task.tags" :key="tag" class="tag">{{ tag }}</span>
    </div>

    <div class="task-card__footer">
      <div class="assignee" :title="task.assignee">{{ initials }}</div>
      <span v-if="task.updatedAt" class="task-card__date">
        {{ new Date(task.updatedAt).toLocaleDateString('zh-CN') }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
  cursor: grab;
  transition: box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.task-card:hover {
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  transform: translateY(-1px);
}

.task-card:active {
  cursor: grabbing;
}

.task-card.is-dragging {
  opacity: 0.4;
  transform: rotate(1.5deg);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18);
}

.task-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.priority {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.priority-high {
  color: #b91c1c;
  background: #fee2e2;
}

.priority-medium {
  color: #b45309;
  background: #fef3c7;
}

.priority-low {
  color: #475569;
  background: #e2e8f0;
}

.task-card__id {
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.task-card__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
}

.task-card__desc {
  margin: 0 0 10px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.task-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.tag {
  font-size: 11px;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 6px;
}

.task-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.assignee {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}

.task-card__date {
  font-size: 11px;
  color: #94a3b8;
}
</style>
