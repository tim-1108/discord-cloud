import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
    faFileArchive,
    faImage,
    faFilePdf,
    faFileWord,
    faFileExcel,
    faFilePowerpoint,
    faFileCode,
    faTable,
    faFileAlt,
    faFileVideo,
    faFileAudio,
    faBook,
    faFont,
    faTerminal,
    faCode,
    faQuestion
} from "@fortawesome/free-solid-svg-icons";

export function mergeFileTypesAndSort(input: Record<string, number>): KnownTypeStorage[] {
    const storage = new Map<string, KnownTypeStorage>();
    const getOrCreate = (name: string, icon: IconDefinition, color?: string /* needed for possible creation */) => {
        let val = storage.get(name);
        if (!val) {
            val = { name, icon, size: 0, color };
            storage.set(name, val);
        }
        return val;
    };

    const type_names = Object.keys(input);
    for (const type_name of type_names) {
        const size = input[type_name];
        const definition = findKnownTypeDefinition(type_name);
        // All ungrouped things are stored in "Unknown"
        const store = definition
            ? getOrCreate(definition.name, definition.icon, definition.color)
            : getOrCreate("Uncategorized", faQuestion, "black");
        store.size += size;
    }
    const arr = Array.from(storage.values());
    return arr.sort((a, b) => {
        if (a.size > b.size) return -1;
        if (a.size < b.size) return 1;
        return 0;
    });
}

function findKnownTypeDefinition(type_name: string): KnownTypeDefinition | null {
    for (const known_type of known_types) {
        // If the pattern does not match, we will try the array next
        // The pattern only exists to catch most, but possibly not all
        // types that we want to consider for this known_type.
        if (known_type.pattern && known_type.pattern.test(type_name)) {
            return known_type;
        }
        if (known_type.types.includes(type_name)) {
            return known_type;
        }
    }
    return null;
}

type KnownTypeStorage = {
    name: string;
    icon: IconDefinition;
    size: number;
    color?: string;
};
type KnownTypeDefinition = {
    // for now practically useless (except pdfs).
    types: string[];
    pattern?: RegExp;
    name: string;
    icon: IconDefinition;
    color: string;
};
const known_types: KnownTypeDefinition[] = [
    {
        name: "Compressed Archives",
        types: [],
        pattern: /(?:zip|7z|rar|gzip|x-?bzip2|x-?xz|x-tar|x-rar|x-7z|x-compress)/i,
        icon: faFileArchive,
        color: "#271d94"
    },

    {
        name: "Images",
        types: [],
        pattern: /^image\//i,
        icon: faImage,
        color: "#0089d2"
    },

    {
        name: "PDF",
        // singleton kept as explicit type (no broader pattern)
        types: ["application/pdf"],
        icon: faFilePdf,
        color: "#ff2117"
    },

    {
        name: "Word Documents",
        types: [],
        pattern: /(?:msword|wordprocessingml|opendocument\.text)/i,
        icon: faFileWord,
        color: "#1758bc"
    },

    {
        name: "Spreadsheets",
        types: ["text/csv"],
        pattern: /(?:vnd\.ms-excel|spreadsheetml|opendocument\.spreadsheet)/i,
        icon: faFileExcel,
        color: "#0c6a35"
    },

    {
        name: "Presentations",
        types: [],
        pattern: /(?:powerpoint|presentationml|opendocument\.presentation)/i,
        icon: faFilePowerpoint,
        color: "#c43e1c"
    },

    {
        name: "HTML / Web Pages",
        types: [],
        pattern: /^text\/html$/i,
        icon: faFileCode,
        color: "#f16524"
    },

    {
        name: "Structured Data",
        types: [],
        pattern: /(?:\/json$|\/xml$|xml\+|json\+|application\/.*\+xml)/i,
        icon: faFileCode,
        color: "#af73ba"
    },
    {
        // Vitally, this needs to go before the other text
        name: "Source Code & Markup",
        types: [],
        pattern: /(?:^text\/x-|^application\/javascript|^text\/javascript|\/(json|xml)$)/i,
        icon: faCode,
        color: "#f6d700"
    },
    {
        name: "Plain Text",
        types: [],
        pattern: /^text\//i,
        icon: faFileAlt,
        color: "#61c4e2"
    },

    {
        name: "Videos",
        types: [],
        pattern: /^video\//i,
        icon: faFileVideo,
        color: "#da4033"
    },

    {
        name: "Audio",
        types: [],
        pattern: /^audio\//i,
        icon: faFileAudio,
        color: "#ec6f00"
    },

    {
        name: "eBooks",
        types: [],
        pattern: /(?:epub|mobi|kindle|book)/i,
        icon: faBook,
        color: "#f7782b"
    },

    {
        name: "Fonts",
        types: [],
        pattern: /^(?:font\/|application\/(font|x-font))/i,
        icon: faFont,
        color: "#000000"
    },

    {
        name: "Executables & Installers",
        types: [],
        pattern: /(?:x-msdownload|portable-executable|x-executable|x-sh|x-msi|x-binary)/i,
        icon: faTerminal,
        color: "#0680d0"
    }
];
