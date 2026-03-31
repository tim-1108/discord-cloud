import { v2 as webdav } from "webdav-server";
import { VirtualFileSystem } from "./VirtualFileSystem";
import { VirutalSerializer } from "./Serializer";
import managerConfig from "../../manager.config";
import { logInfo } from "../../common/logging";
import { DAVUserManager } from "./DAVUserManager";

// We cannot use digest authentication because that would either require us to:
// - store the password in plaintext
// - store the md5 hash of "<username>:<realm>:<password>"
// In both cases, a leak of this data would mean that passwords are easily reversable
// with for instance rainbow tables.
// Basic authentication is insecure, but only when occuring over non-TLS HTTP.
// This is the same lack of security as the default api would expose the /login route to.

const server = new webdav.WebDAVServer({
    requireAuthentification: true,
    httpAuthentication: new webdav.HTTPBasicAuthentication(new DAVUserManager(), managerConfig.webdav.realmName),
    rootFileSystem: new VirtualFileSystem(new VirutalSerializer()),
    port: managerConfig.webdav.port
});

let hasStarted = false;
export function startWebDAVServer() {
    if (hasStarted) {
        throw new Error("WebDAV server already has been started");
    }
    if (!managerConfig.webdav.enabled) {
        throw new Error("Attempted to start WebDAV instance, but is disabled in config");
    }
    hasStarted = true;
    server.start(() => logInfo("Init: WebDAV instance live on port", managerConfig.webdav.port));
}
