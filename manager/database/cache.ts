/**
 * What caches do we need:
 *
 * a folder tree, containing the following:
 * - the name of the folder
 * - the id of the folder
 * - a ref to the parent folder, if present
 *      this eases lookups where we build a path string
 *      from a folder id or just need to traverse up the tree.
 * - Set of subfolders we know exist
 * - Set of subfolders we know do not exist (they have been lookup up previously)
 * - Bool on whether this folder is locked
 * - Set of file names which are locked
 * - Size map of file types
 *
 * These are all data structures that might be expensive to request from the DB.
 * Listings are explicitly not on this list here, as that would essentially mean
 * re-creating the entire database within the server. Things like locks should
 * not be stored in the database and folder id lookups happen very frequently.
 * Looking up files is essentially the fastest possible thing, as we just have
 * one filter and that's it.
 *
 * This structure would require a tree of map objects. However, we also need
 * to support lookups via the folder id for some operations. Therefore, we have
 * another Map containing a non-exhaustive list of all these folder branches.
 * This list is likely never complete as that
 */
