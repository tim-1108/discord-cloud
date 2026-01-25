# The `database` directory

All functions are exposed via the `Database` field within `index.ts`.

## Caching

There is primarily one cache implemented, in `tree.ts`. This cache contains a exhaustive tree structure as well as a id map of all folders in existence. This provides access to the creation and lookup of folders via `Database.folderHandle` and `Database.folderId`.

The tree itself also stores information on file type sizes in the corresponding folders and subfolders, to be collected and modified via `Database.tree.fileTypes`. This is fully cached on the server and initialized when `Database.tree.init` is called upon server start. This tree does not contain any file information.

A deprecated cache within `file.ts` is the file handle cache, containing files accessible via folder id or file id. These caches are updated whenever a file changes (like via `Database.file.update`). If a folder is dropped, call `Database.cache.dropFolderIdFromFileCache`, until the function is removed together with the entire cache.

Individual file operations tend to draw from this cache, but listings are always performed from the database, with these files then being added to the cache.
