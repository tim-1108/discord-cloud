import { invalidateFolderCache, resolvePathToFolderId_Cached } from "./core.js";
import { getFileShare } from "./file-share.js";
import { addFileHandle, deleteFileHandle, getFileHandle_Cached, getFileHandleWithPath_Cached, updateFileHandle } from "./file.js";
import { addFolder, createOrGetFolderByPath, getFolderById_Database, getFolderByNameAndParent_Database, getFolderByPath } from "./folder.js";
import { removeThumbnailFromStorage, uploadThumbnailToStorage } from "./storage.js";
import { getUserFromDatabase, updateUserPassword } from "./users.js";

export const Database = {
    cache: {
        invalidateFolder: invalidateFolderCache
    },
    thumbnail: {
        upload: uploadThumbnailToStorage,
        delete: removeThumbnailFromStorage
    },
    user: {
        get: getUserFromDatabase,
        updatePassword: updateUserPassword
    },
    folder: {
        add: addFolder,
        getByPath: getFolderByPath,
        getById: getFolderById_Database,
        getByNameAndParent: getFolderByNameAndParent_Database,
        getOrCreateByPath: createOrGetFolderByPath
    },
    file: {
        add: addFileHandle,
        update: updateFileHandle,
        delete: deleteFileHandle,
        get: getFileHandle_Cached,
        getWithPath: getFileHandleWithPath_Cached,
        share: {
            get: getFileShare
        }
    },
    authenticated: {}
} as const;
