import type { DataErrorFields } from "../../common";
import type { Database } from "../../common/supabase";
import { supabase } from "./core";
type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
type Key = keyof Tables | keyof Views;
type Value<K extends Key> = K extends keyof Tables ? Tables[K]["Row"] : K extends keyof Views ? Views[K]["Row"] : undefined;

async function get<K extends Key>(key: K): Promise<DataErrorFields<Value<K>[]>> {
    const arr = new Array<Value<K>>();
    let index = 0;
    while (true) {
        const { data, error } = await supabase
            // supabase.from has two overloads, for tables and for views.
            // To have everything working in one function like here, it is not happy.
            // @ts-expect-error
            .from(key)
            .select("*")
            .range(index, index + 99);
        if (error) {
            return { data: null, error: `Error after index: ${index} | ${error.details}` };
        }
        if (!data.length) break;
        index += data.length;
        arr.push(...(data as Value<K>[]));
    }
    return { data: arr, error: null };
}

export const Database$GetAll = get;
