import { shallowRef } from "vue";

export const PendingAuthenticationState = shallowRef<"pending" | "health" | "login" | "establishing" | "established">("pending");
export const ListingViewState = shallowRef<"condensed-table" | "table" | "grid">("table");
