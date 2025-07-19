import { invalidateFolderCache, ROOT_FOLDER_ID } from "./core.js";
import { deleteFileShare, getFileShare, insertFileShare, updateFileShare } from "./file-share.js";
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
    getFileCount_folder,
    getFolderById_Database,
    getFolderByNameAndParent_Database,
    getFolderByPath,
    getSubfolderCount_folder,
    renameFolder,
    resolveRouteFromFolderId
} from "./folder.js";
import { listSubfolders } from "./public.js";
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
        rename: renameFolder,
        counts: {
            files: getFileCount_folder,
            subfolders: getSubfolderCount_folder
        },
        listing: {
            files: listFilesInFolder_Database,
            subfolders: listSubfolders
        }
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
        findReplacementName: findReplacementFileName,
        rename: renameFile,
        share: {
            get: getFileShare,
            insert: insertFileShare,
            delete: deleteFileShare,
            update: updateFileShare
        }
    }
} as const;
