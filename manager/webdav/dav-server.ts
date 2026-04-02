import { v2 as webdav } from "webdav-server";
import { VirtualFileSystem } from "./VirtualFileSystem";
import { VirutalSerializer } from "./Serializer";
import managerConfig from "../../manager.config";
import { logInfo, logWarn } from "../../common/logging";
import { BasicAuthentication } from "./BasicAuthentication";

// We cannot use digest authentication because that would either require us to:
// - store the password in plaintext
// - store the md5 hash of "<username>:<realm>:<password>"
// In both cases, a leak of this data would mean that passwords are easily reversable
// with for instance rainbow tables.
// Basic authentication is insecure, but only when occuring over non-TLS HTTP.
// This is the same lack of security as the default api would expose the /login route to.
// For instance, Windows Explorer only handles Basic authentication over HTTPS

const server = new webdav.WebDAVServer({
    requireAuthentification: !managerConfig.webdav.disableAuthentication,
    httpAuthentication: !managerConfig.webdav.disableAuthentication ? new BasicAuthentication() : undefined,
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

    if (managerConfig.webdav.disableAuthentication) {
        logWarn("Init: WebDAV authentication is disabled, for non-production use only");
    }

    server.start(() => logInfo("Init: WebDAV instance live on port", managerConfig.webdav.port));
}
