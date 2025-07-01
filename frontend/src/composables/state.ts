import { shallowRef } from "vue";

export const PendingAuthenticationState = shallowRef<"pending" | "health" | "login" | "establishing" | "established">("pending");
