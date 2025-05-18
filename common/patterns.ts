const MAX_SUBFOLDER_COUNT = 10 as const;
const MAX_TITLE_LENGTH = 127 as const;

/**
 * Allows all alphanumerical characters, spaces and a lot of special characters.
 *
 * No slashes, backslashes or double-dots allowed!
 */
function createCharacterset(type: "allowed" | "negated") {
    return `[${type === "negated" ? "^" : ""}\\d\\w-+#.*~^°!"'’_§$%&()[\\]{}=?ß,;äöüéèêëáàâäíìîïóòôöúùûüñç ]`;
}

const ALLOWED_CHARS_NEGATIVE_LOOKAHEAD = `((?!\\.\\.)${createCharacterset("allowed")})`;
const ALLOWED_CHARS_WITH_LENGTH = `${ALLOWED_CHARS_NEGATIVE_LOOKAHEAD}{1,${MAX_TITLE_LENGTH}}`;
const ALLOWED_CHARS_PATTERN = new RegExp(ALLOWED_CHARS_NEGATIVE_LOOKAHEAD, "gi");
const NEGATED_SET = new RegExp(createCharacterset("negated"), "gi");

/**
 * Returns a `RegExp` which contains a set of all characters usable inside
 * folder and file names. Does not allow multiple dots (path-traversal).
 *
 * Has flags g and i, to be used in `String.prototype.match` or else to
 * replace illegal characters.
 */
export function getAllowedCharacterPattern(): RegExp {
    return ALLOWED_CHARS_PATTERN;
}
export function getNegatedCharacterPattern(): RegExp {
    return NEGATED_SET;
}

export function getNamingMaximumLengths() {
    return { title: MAX_TITLE_LENGTH, subfolderCount: MAX_SUBFOLDER_COUNT };
}

export const patterns = {
    /**
     * A path may only consist of {@link MAX_SUBFOLDER_COUNT} subfolders, each with
     * a length of {@link MAX_TITLE_LENGTH}.
     *
     * Any path may also only be a "/", indicating the root folder.
     *
     * Paths are structured using subfolders, seperated with a slash.
     * This follows Unix-like pathing, thus not having a slash at the very end.
     *
     * - /folder/deeper-folder/thus/thusly
     *
     * But: We also accept these slashes at the very end, but just ignore them.
     */
    stringifiedPath: new RegExp(`^\/((${ALLOWED_CHARS_WITH_LENGTH}\/){0,${MAX_SUBFOLDER_COUNT - 1}}(${ALLOWED_CHARS_WITH_LENGTH})){0,1}\/?$`, "i"),
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
    packetId: /^(([a-z]2[a-z])|generic):[a-z\-0-9]+$/,
    /**
     * Base64 data compatible to be included inside URL query
     */
    base64Url: /^[a-zA-Z0-9_-]+$/,
    /**
     * Represents an SHA-256 hash
     */
    hash: /^[0-9a-f]{64}$/,
    snowflake: /^[0-9]{15,22}$/
};
