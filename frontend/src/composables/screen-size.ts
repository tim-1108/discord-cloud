import { ref, type Ref } from "vue";

const delimiter = 768;
const state = ref(false);
function checkAndUpdate(): void {
    // The md: selector triggers at anything of 768 pixels or greater
    const flag = window.innerWidth < delimiter;
    // To not do unnecessary "updates" to the ref.
    if (state.value === flag) return;
    state.value = flag;
}
window.addEventListener("resize", checkAndUpdate);
checkAndUpdate();

export function useMobileState(): Readonly<Ref<boolean>> {
    return state;
}
