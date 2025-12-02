import { supabase } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";

async function getFileTypeTotalSizes_Database(): Promise<{ sum: number; type: string }[] | null> {
    const response = supabase.from("get_file_type_total_size").select("*").limit(Number.MAX_SAFE_INTEGER);
    const data = await parsePostgrestResponse<{ sum: number | null; type: string | null }[]>(response);
    // @ts-expect-error type detection from Array filter not working or me dumb
    return data ? data.filter(({ sum, type }) => sum !== null && type !== null) : null;
}

async function getFolderAndTypeSizes_Database(): Promise<{ sum: number; type: string; folder: number | null }[] | null> {
    const response = supabase.from("get_folder_sizes_by_file_type").select("*").limit(Number.MAX_SAFE_INTEGER);
    const data = await parsePostgrestResponse<{ folder: number | null; type: string | null; sum: number | null }[]>(response);
    // @ts-expect-error type detection from Array filter not working or me dumb
    return data ? data.filter(({ sum, type }) => sum !== null && type !== null) : null;
}

export const Database$Sizes = {
    getFileTypeTotalSizes_Database,
    getFolderAndTypeSizes_Database
} as const;
