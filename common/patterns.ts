const MAX_SUBFOLDER_COUNT = 10;
const MAX_TITLE_LENGTH = 127;

/**
 * Allows all alphanumerical characters, spaces and a lot of special characters.
 *
 * No slashes, backslashes or double-dots allowed!
 */
const ALLOWED_CHARS = `((?!\\.\\.)[\\d\\w-+#.*~^°!"'§$%&()[\\]{}=?ß,; ])`;
const ALLOWED_CHARS_WITH_LENGTH = `${ALLOWED_CHARS}{1,${MAX_TITLE_LENGTH}}`;

export const patterns = {
    /**
     * A path may only consist of {@link MAX_SUBFOLDER_COUNT} subfolders, each with
     * a length of {@link MAX_TITLE_LENGTH}.
     *
     * It may also be just /, but every path has to end with another /.
     */
    stringifiedPath: new RegExp(`^\/(${ALLOWED_CHARS_WITH_LENGTH}\/){0,${MAX_SUBFOLDER_COUNT}}$`, "i"),
    /**
     * A file or folder name may only consist of specific characters
     * specified in {@link ALLOWED_CHARS} and have
     * a max length of {@link MAX_TITLE_LENGTH}
     */
    fileName: new RegExp(`^${ALLOWED_CHARS_WITH_LENGTH}$`, "i"),
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    multipart: /^multipart\/form-data;\s*boundary=[a-z0-9'()+_,-.\/:=?]+$/i
};
