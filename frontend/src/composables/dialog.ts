import AlertDialog from "@/components/dialog/AlertDialog.vue";
import ConfirmDialog from "@/components/dialog/ConfirmDialog.vue";
import LoginDialog from "@/components/dialog/LoginDialog.vue";
import RenameActionDialog from "@/components/dialog/RenameActionDialog.vue";
import UploadSubmitDialog from "@/components/dialog/UploadSubmitDialog.vue";
import { h, ref, type DefineComponent, type VNode } from "vue";
import { createResolveFunction } from "../../../common/useless";
import UploadsDialog from "@/components/dialog/UploadsDialog.vue";
import OverwriteDialog from "@/components/dialog/OverwriteDialog.vue";
import type { UUID } from "../../../common";

const components = {
    "upload-submit": UploadSubmitDialog,
    rename: RenameActionDialog,
    confirm: ConfirmDialog,
    login: LoginDialog,
    alert: AlertDialog,
    uploads: UploadsDialog,
    overwrite: OverwriteDialog
} as const;
type ComponentName = keyof typeof components;
const list = ref(new Map<ComponentName, VNode>());

/**
 * Infers the props of a Component object passed into the type.
 */
export type PropsOf<C> = C extends DefineComponent<infer P, any, any, any, any> ? P : never;

function mount<N extends ComponentName>(name: N, props: PropsOf<(typeof components)[N]>) {
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
export interface AlertDialogConfig {
    title?: string;
    body: string;
    confirm?: string;
}
export interface OverwriteDialogConfig {
    uploadId: UUID;
    fileName: string;
    path: string;
}
async function confirmDialog(cfg: ConfirmDialogConfig): Promise<boolean> {
    const { promise, resolve } = createResolveFunction<boolean>();
    const hasMounted = mount("confirm", { cfg, callback: resolve });
    if (!hasMounted) {
        // TODO: maybe allow to mount multiple at once
        return false;
    }
    const result = await promise;
    unmount("confirm");
    return result;
}

async function alertDialog(cfg: AlertDialogConfig): Promise<void> {
    const { promise, resolve } = createResolveFunction();
    const hasMounted = mount("alert", { cfg, callback: resolve });
    if (!hasMounted) {
        // TODO: maybe allow to mount multiple at once
        return;
    }
    await promise;
    unmount("alert");
}

export const Dialogs = {
    mount,
    unmount,
    isMounted,
    iterator: list,
    confirm: confirmDialog,
    alert: alertDialog
};
