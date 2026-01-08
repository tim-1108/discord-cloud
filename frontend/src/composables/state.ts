import { shallowRef } from "vue";
import type { SortingFieldOptions } from "./listing_uncached";

export const PendingAuthenticationState = shallowRef<"pending" | "health" | "login" | "establishing" | "established">("pending");
export const ListingViewState = shallowRef<"condensed-table" | "table" | "grid">("table");
export const ListingSortFieldState = shallowRef<(typeof SortingFieldOptions)[number]["field"]>("name");
export const ListingSortAscendingState = shallowRef<boolean>(true);
