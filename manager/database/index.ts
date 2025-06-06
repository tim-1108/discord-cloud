import { invalidateFolderCache } from "./core.js";
import { getFileShare } from "./file-share.js";
import {
    addFileHandle,
    deleteFileHandle,
    getFileHandle_Cached,
    getFileHandleById_Cached,
    getFileHandleWithPath_Cached,
    listFilesInFolder_Database,
    updateFileHandle
} from "./file.js";
import {
    addFolder,
    createOrGetFolderByPath,
    getFolderById_Database,
    getFolderByNameAndParent_Database,
    getFolderByPath,
    resolveRouteFromFolderId
} from "./folder.js";
import { removeThumbnailFromStorage, uploadThumbnailToStorage } from "./storage.js";
import { createUser, getUserByName_Database, getUser_Database, updateUserPassword } from "./users.js";

export const Database = {
    cache: {
        invalidateFolder: invalidateFolderCache
    },
    thumbnail: {
        upload: uploadThumbnailToStorage,
        delete: removeThumbnailFromStorage
    },
    user: {
        add: createUser,
        get: getUser_Database,
        getByName: getUserByName_Database,
        updatePassword: updateUserPassword
    },
    folder: {
        add: addFolder,
        getByPath: getFolderByPath,
        getById: getFolderById_Database,
        getByNameAndParent: getFolderByNameAndParent_Database,
        getOrCreateByPath: createOrGetFolderByPath,
        resolveRouteById: resolveRouteFromFolderId
    },
    file: {
        add: addFileHandle,
        update: updateFileHandle,
        delete: deleteFileHandle,
        /**
         * FIXME: Although this technically supports inserting paths,
         *        Typescript will always complain as any string does
         *        not fit the `/${string}` requirement of the type,
         *        even though it has been validated as a path previously.
         */
        get: getFileHandle_Cached,
        getWithPath: getFileHandleWithPath_Cached,
        getById: getFileHandleById_Cached,
        listInFolder: listFilesInFolder_Database,
        share: {
            get: getFileShare
        }
    }
} as const;
