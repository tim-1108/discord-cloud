import { invalidateFolderCache, ROOT_FOLDER_ID } from "./core.js";
import { getFileShare } from "./file-share.js";
import {
    addFileHandle,
    deleteFileHandle,
    findReplacementFileName,
    getFileHandle_Cached,
    getFileHandleById_Cached,
    getFileHandleWithPath_Cached,
    listFilesInFolder_Database,
    renameFile,
    updateFileHandle
} from "./file.js";
import {
    addFolder,
    createOrGetFolderByPath,
    getFolderById_Database,
    getFolderByNameAndParent_Database,
    getFolderByPath,
    renameFolder,
    resolveRouteFromFolderId
} from "./folder.js";
import { getSignedLinkForThumbnail, deleteThumbnailFromStorage, uploadThumbnailToStorage } from "./storage.js";
import { createUser, getUserByName_Database, getUser_Database, updateUserPassword } from "./users.js";

export const Database = {
    root: "root" as const,
    cache: {
        invalidateFolder: invalidateFolderCache
    },
    thumbnail: {
        upload: uploadThumbnailToStorage,
        delete: deleteThumbnailFromStorage,
        getSignedLink: getSignedLinkForThumbnail
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
        resolveRouteById: resolveRouteFromFolderId,
        rename: renameFolder
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
        findReplacementName: findReplacementFileName,
        rename: renameFile,
        share: {
            get: getFileShare
        }
    }
} as const;
