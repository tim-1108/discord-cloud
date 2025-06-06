import ConfirmDialog from "@/components/dialog/ConfirmDialog.vue";
import LoginDialog from "@/components/dialog/LoginDialog.vue";
import RenameActionDialog from "@/components/dialog/RenameActionDialog.vue";
import UploadSubmitDialog from "@/components/dialog/UploadSubmitDialog.vue";
import { h, ref, type VNode } from "vue";

const components = {
    "upload-submit": UploadSubmitDialog,
    rename: RenameActionDialog,
    confirm: ConfirmDialog,
    login: LoginDialog
} as const;
type ComponentName = keyof typeof components;
const list = ref(new Map<ComponentName, VNode>());

function mount(name: ComponentName, props?: Record<string, any>) {
    if (list.value.has(name)) {
        return false;
    }
    const cmp = components[name];
    const vn = h(cmp, props);
    // TODO: should you be able to open the same dialog twice
    //       (the same id, so i.e. a confirm box)
    list.value.set(name, vn);
    return true;
}

function unmount(name: ComponentName) {
    const vn = list.value.get(name);
    if (!vn) {
        return false;
    }

    return list.value.delete(name);
}

function isMounted(name: ComponentName) {
    return list.value.has(name);
}

export interface ConfirmDialogConfig {
    title?: string;
    body: string;
    cancel?: string;
    confirm?: string;
}
async function confirmDialog(cfg: ConfirmDialogConfig): Promise<boolean> {
    // TODO: mount a confirm dialog and return a boolean depending on what the user selects!
    let resolve: ((val: boolean) => void) | undefined = undefined;
    const p = new Promise<boolean>((r) => (resolve = r));
    const hasMounted = mount("confirm", { cfg, callback: resolve });
    if (!hasMounted) {
        // TODO: maybe allow to mount multiple at once
        return false;
    }
    const result = await p;
    unmount("confirm");
    return result;
}

export const Dialogs = {
    mount,
    unmount,
    isMounted,
    iterator: list,
    confirm: confirmDialog
};
