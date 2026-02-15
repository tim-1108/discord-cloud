<template>
    <div
        class="notification-item bg-blue-500 rounded-lg shadow-md cursor-pointer hover:active:scale-95 p-2 opacity-0 select-none text-white"
        :class="{ 'fading-out': isFadingOut }"
        @click="fadeOut"
        :style="{ '--time': item.timeout ? item.timeout / 1000 : 0 }">
        <div class="p-2">
            <h3>{{ item.title }}</h3>
            <p v-html="item.description"></p>
        </div>
        <div class="countdown w-full h-1 bg-white rounded-full shadow"></div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { sleep } from "../../../../common/useless";
import type { UUID } from "../../../../common";
import { useNotifications, type WebNotification } from "@/composables/notifications";
const notifications = useNotifications();
const props = defineProps<{ item: WebNotification; id: UUID }>();

onMounted(async () => {
    if (typeof props.item.timeout !== "number") return;
    await sleep(props.item.timeout);
    fadeOut();
});

const isFadingOut = ref(false);
async function fadeOut() {
    isFadingOut.value = true;
    await sleep(150);
    notifications.value.delete(props.id);
}
</script>

<style scoped>
@keyframes countdown {
    from {
        width: 100%;
    }
    to {
        width: 0;
    }
}
@keyframes fade-in {
    from {
        opacity: 0;
        translate: 0 10px;
    }
    to {
        opacity: 100%;
    }
}
@keyframes fade-out {
    from {
        opacity: 100%;
    }
    to {
        opacity: 0;
        translate: 0 10px;
    }
}
.countdown {
    animation: countdown ease-in forwards;
    animation-duration: calc(var(--time) * 1s);
}
.notification-item {
    animation: fade-in forwards 150ms linear;
}
.notification-item.fading-out {
    animation: fade-out forwards 150ms linear;
}
</style>
