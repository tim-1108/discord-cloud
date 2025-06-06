import {
    faFile,
    faFileAudio,
    faFileCode,
    faFileExcel,
    faFileImage,
    faFileLines,
    faFilePdf,
    faFilePowerpoint,
    faFileVideo,
    faFileWord,
    faFileZipper,
    type IconDefinition
} from "@fortawesome/free-solid-svg-icons";

const extentions = [
    { exts: ["xls", "xlsx", "xlsm", "csv"], icon: faFileExcel },
    { exts: ["doc", "docx", "dot", "dotx", "odt", "rtf"], icon: faFileWord },
    { exts: ["ppt", "pptx", "pptm", "pps", "ppsx"], icon: faFilePowerpoint },
    { exts: ["txt", "log", "md", "json", "xml", "csv", "yaml"], icon: faFileLines },
    { exts: ["pdf"], icon: faFilePdf },
    { exts: ["zip", "rar", "7z", "tar", "gz", "bz2", "iso", "jar"], icon: faFileZipper },
    { exts: ["jpg", "jpeg", "png", "gif", "bmp", "svg", "tiff", "webp"], icon: faFileImage },
    { exts: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"], icon: faFileAudio },
    { exts: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm", "mpeg"], icon: faFileVideo },
    { exts: ["c", "cs", "cpp", "h", "java", "js", "ts", "py"], icon: faFileCode }
];

export function getIconForFileType(filename: string): IconDefinition {
    const ext = filename.split(".").at(-1)?.toLowerCase() ?? "";
    if (!ext.length) {
        return faFile;
    }

    for (const { exts, icon } of extentions) {
        if (exts.includes(ext)) {
            return icon;
        }
    }

    return faFile;
}
