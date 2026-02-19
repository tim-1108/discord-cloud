import ConnectionFlyout from "@/components/flyout/ConnectionFlyout.vue";
import PropertiesFlyout from "@/components/flyout/PropertiesFlyout.vue";
import UploadsFlyout from "@/components/flyout/UploadsFlyout.vue";
import { h, ref, type Ref, type VNode } from "vue";
import { logError } from "../../../common/logging";
import { createResolveFunction } from "../../../common/useless";
import type { ResolveFunction } from "../../../common";

// Flyouts are stateless boxes that are spawned at the position
// of their parent, either below or above, depending on the space.
// Only one flyout may be open at once.

export const Flyout = {
    mount,
    unmount,
    status,
    resolve,
    updatePosition
} as const;

const Constants = {
    marginToScreenBorder: 10
} as const;

const Registry = {
    uploads: UploadsFlyout,
    connection: ConnectionFlyout,
    properties: PropertiesFlyout
} as const;
type RegistryKey = keyof typeof Registry;
export type FlyoutRegistryKey = RegistryKey;

const parent = ref<string | null>(null);
const element = ref<Element | null>(null);
const mounted = ref<VNode | null>(null);
const mountedKey = ref<RegistryKey | null>(null);
/**
 * The first two values represent the x and y values.
 * The remainder represent the width and the height,
 * in that order. This is fixed so whenever the content
 * of the flyout changes - which it ideally should not -
 * the size stayes the same.
 */
type Position = [number, number, number, number];
const position = ref<Position | null>(null);
export const useFlyoutVnode = (): Ref<VNode | null> => mounted;
export const useFlyoutPosition = (): Ref<Position | null> => position;

const resolver = ref<ResolveFunction<Element>>();
/**
 * Resolves the mount promise with a flyout `HTMLElement`, or null,
 * allowing any value from the `useTemplateRef` to be inputted.
 *
 * The reason we don't just use `ref` attribute when calling `h()` is that
 * a template ref, something we would create then, always requires an owner
 * component. This implementation here is the easiest way to give the `mount()`
 * function the mounted `HTMLElement` once it has actually been mounted.
 */
function resolve(value: Element | null) {
    if (!value) {
        logError("Called `resolve` for the flyout with a null ref value");
        return;
    }
    if (resolver.value) {
        resolver.value(value);
    }
}

async function mount(key: RegistryKey, parentSelector: string): Promise<void> {
    const parentElement = document.querySelector(parentSelector);
    if (mounted.value) {
        unmount();
    }

    if (!parentElement) return;

    const cmp = Registry[key];
    const vnode = h(cmp);

    mounted.value = vnode;
    mountedKey.value = key;

    const { promise, resolve } = createResolveFunction<Element>();
    resolver.value = resolve;

    // Well, we have to wait and hope that it properly mounts.
    const result = await promise;
    element.value = result;
    parent.value = parentSelector;
    // This code could sit here, but the updatePosition call
    // from outside is very important.
    updatePosition();
}

function updatePosition(): void {
    if (!parent.value || !element.value) return;
    const parentElement = document.querySelector(parent.value);
    if (!parentElement) return;

    const parentRect = parentElement.getBoundingClientRect();
    const rect = element.value.getBoundingClientRect();

    // For now, this system assumes that the dimensions of the flyout stay
    // constant troughout its life. This may not always be the case. When
    // content changes, there should either be an event listener or a function
    // to call in here that will recompute that.
    const right = window.innerWidth - Constants.marginToScreenBorder;
    const left = Constants.marginToScreenBorder;
    const bottom = window.innerHeight - Constants.marginToScreenBorder;
    // whether to spawn at the bottom of the parent
    const useBottom = parentRect.top + parentRect.height + rect.height <= bottom;
    const spawnY = useBottom ? parentRect.top + parentRect.height : parentRect.top - rect.height;

    // This is our desired center position. If this goes outside
    // the borders, we have to
    const centerX = parentRect.left + parentRect.width / 2;
    const halfWidth = rect.width / 2;
    const targetX = centerX - halfWidth;

    // How far the element goes too far on the right side
    const deltaRight = centerX + halfWidth - right;
    // First option: It is too far left, just move it to the right somewhat.
    // Second option: deltaRight > 0, which means we need to move it over by that much
    // Last: The center is already aligned well.
    const spawnX = targetX < left ? left : deltaRight > 0 ? targetX - deltaRight : targetX;
    position.value = [spawnX, spawnY, rect.width, rect.height];
}

function unmount() {
    mounted.value = null;
    mountedKey.value = null;
    position.value = null;
    parent.value = null;
    element.value = null;
}

function status(key: RegistryKey): boolean {
    return mountedKey.value === key;
}

window.addEventListener("resize", updatePosition);
