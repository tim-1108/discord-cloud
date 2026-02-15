import { ref } from "vue";
import type { UUID } from "../../../common";

const notifications = ref<Map<UUID, WebNotification>>(new Map());
export const useNotifications = () => notifications;

export interface WebNotification {
    title: string;
    description?: string;
    timeout?: number;
    actions?: {
        name: string;
        callback: () => Promise<any>;
    }[];
}

export async function addNotification(item: WebNotification) {
    const notifications = useNotifications();
    const id = crypto.randomUUID();
    notifications.value.set(id, item);
}
