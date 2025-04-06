import { ref } from "vue";

type SidebarState = "auth" | "default" | "upload";
const sidebarState = ref<SidebarState>("auth");
export function useSidebarState() {
    return sidebarState;
}
