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
    multipart: /^multipart\/form-data;\s*boundary=[a-z0-9'()+_,-.\/:=?]+$/i,
    /**
     * An insecure pattern to make sure only numbers are inputted.
     * Allows for all digits to be inputted at will but prevents any other
     * characters.
     */
    integer: /^(-)?\d{1,10}$/,
    webhookUrl: /^https:\/\/((canary|www)\.)?discord\.com\/api\/webhooks\/\d{17,22}\/[a-zA-Z0-9_]{10,100}$/,
    /**
     * A packet id should be of format "<from>2<to>:<packet id, containing lowercase chars, numbers and hyphens>".
     *
     * From and to consist of one character each.
     */
    packetId: /^[a-z]2[a-z]:[a-z\-0-9]+$/,
    /**
     * Base64 data compatible to be included inside URL query
     */
    base64Url: /^[a-zA-Z0-9_-]+$/,
    /**
     * Represents an SHA-256 hash
     */
    hash: /^[0-9a-f]{64}$/
};
