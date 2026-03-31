import type { IListUserManager, ITestableUserManager, IUser, SimpleUserManager } from "webdav-server/lib/index.v2";
import { Database } from "../database";
import { patterns } from "../../common/patterns";
import { Authentication } from "../authentication";

export class DAVUserManager implements ITestableUserManager {
    async getUserByNamePassword(name: string, password: string, callback: (error: Error, user?: IUser) => void) {
        if (!patterns.username.test(name)) {
            return callback(Error("username is invalid"));
        }
        const user = await Database.users.getByName(name);
        if (!user) {
            return callback(Error("user not found"));
        }
        const valid = Authentication.password.verify(user.password, password, user.salt);
        if (valid) {
            // @ts-expect-error The library expects us to pass an Error object within the callback,
            //                  but if anything that is not falsy is passed, the function fails... amazing.
            return callback(undefined, { uid: user.id.toString(), username: user.username });
        }
        callback(Error("invalid password"));
    }
    getDefaultUser(callback: (user: IUser) => void): void {
        callback({ isAdministrator: false, isDefaultUser: true, username: "default", uid: "default" });
    }
}
