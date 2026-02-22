import { deleteAllFileShares, deleteFileShare, getFileShare, insertFileShare, updateFileShare } from "./file-share.js";
import {
    addFileHandle,
    deleteFileHandle,
    dropFolderFromFileCache,
    getFileHandle_Cached,
    getFileHandleById_Cached,
    listFilesInFolder_Database,
    renameFile,
    updateFileHandle
} from "./file.js";
import {
    addFolder,
    deleteFolder_Recursive,
    getFileCount_folder,
    getSubfolderCount_folder,
    listSubfoldersInFolder_Database,
    renameFolder,
    resolveRouteFromFolderId,
    traverseTreeForFiles
} from "./folder.js";
import { Database$GetAll } from "./get-all.js";
import { getSignedLinkForThumbnail, deleteThumbnailFromStorage, uploadThumbnailToStorage } from "./storage.js";
import { Database$FolderHandle, Database$FolderId, Database$Tree } from "./tree.js";
import { createUser, getUserByName_Database, getUserCount, getUser_Database, updateUserPassword } from "./users.js";

export const Database = {
    root: "root" as const,
    cache: {
        dropFolderIdFromFileCache: dropFolderFromFileCache
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
        getCount: getUserCount,
        updatePassword: updateUserPassword
    },
    folder: {
        add: addFolder,
        resolveRouteById: resolveRouteFromFolderId,
        rename: renameFolder,
        counts: {
            files: getFileCount_folder,
            subfolders: getSubfolderCount_folder
        },
        listing: {
            files: listFilesInFolder_Database,
            subfolders: listSubfoldersInFolder_Database
        },
        delete: deleteFolder_Recursive,
        traverseTreeForFiles
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
        getById: getFileHandleById_Cached,
        rename: renameFile,
        share: {
            get: getFileShare,
            insert: insertFileShare,
            delete: deleteFileShare,
            update: updateFileShare,
            deleteAll: deleteAllFileShares
        }
    },
    folderId: Database$FolderId,
    folderHandle: Database$FolderHandle,
    tree: Database$Tree,
    getAll: Database$GetAll
} as const;
