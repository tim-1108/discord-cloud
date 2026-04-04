import { type HTTPAuthentication, type HTTPRequestContext, type IUser, Errors } from "webdav-server/lib/index.v2";
import managerConfig from "../../manager.config";
import { patterns } from "../../common/patterns";
import { Database } from "../database";
import { Authentication } from "../authentication";

/**
 * Reimplementation of the HTTPBasicAuthentication class in the `webdav-server`
 * library (v2), because 1) we don't need a UserManager, that is just redundant,
 * and 2) their regex pattern for the basic authorization header is broken,
 * as it does not include "+" or "/".
 */
export class BasicAuthentication implements HTTPAuthentication {
    readonly realm = managerConfig.webdav.realmName;
    askForAuthentication(ctx: HTTPRequestContext): { [headeName: string]: string } {
        return {
            "WWW-Authenticate": `Basic realm="${this.realm}"`
        };
    }
    async getUser(ctx: HTTPRequestContext, callback: (error: Error, user?: IUser) => void): Promise<void> {
        const header = ctx.headers.find("Authorization");

        // For the RequestContext class to work properly in the library,
        // it expects us to use their errors as defined in their list.
        function returnDefaultUser(error: (typeof Errors)[Exclude<keyof typeof Errors, "None">]): void {
            callback(error, { isAdministrator: false, isDefaultUser: true, uid: "DefaultUser", username: "default" });
        }

        if (!header || !patterns.basicAuthorizationHeader.test(header)) {
            return returnDefaultUser(Errors.MissingAuthorisationHeader);
        }

        const base64 = patterns.basicAuthorizationHeader.exec(header);
        if (base64?.length !== 2) {
            return returnDefaultUser(Errors.MissingAuthorisationHeader);
        }
        const buffer = Buffer.from(base64[1], "base64");
        const [input_username, input_password] = buffer.toString("ascii").split(":");
        if (!input_username || !input_password) {
            return returnDefaultUser(Errors.MissingAuthorisationHeader);
        }

        const user = await Database.users.getByName(input_username);
        if (!user) {
            return returnDefaultUser(Errors.UserNotFound);
        }

        const valid = Authentication.password.verify(user.password, input_password, user.salt);
        valid
            ? // @ts-expect-error not returning null as the Error field may produce unexpected outcomes
              //                  The definition of the callback is quite bad, as it always requires an error object
              callback(null, { isAdministrator: false, isDefaultUser: false, uid: user.id.toString(), username: user.username })
            : returnDefaultUser(Errors.BadAuthentication);
    }
}
