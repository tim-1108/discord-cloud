import type { Request, Response } from "express";
import { getRequestQuery, generateErrorResponse, getRequestAuthorization } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { logDebug, logError, logWarn } from "../../common/logging.js";
import { getAllFilesInSubfolders } from "../database/public.js";
import { streamFileContents } from "../utils/stream-download.js";
import { Authentication } from "../authentication.js";

export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const query = getRequestQuery(req);
    if (!query) {
        return void generateErrorResponse(res, 400, "Bad request query");
    }

    const path = query.get("path");

    if (!path || !patterns.stringifiedPath.test(path)) {
        return void generateErrorResponse(res, 400, "Bad path");
    }

    const auth = getRequestAuthorization(req);
    const user = await Authentication.verifyUserToken(auth);
    if (user === null) {
        return void generateErrorResponse(res, 401, "Unauthorized");
    }

    const { socket } = res;
    if (socket === null) {
        return void generateErrorResponse(res, 500);
    }

    let _closed = !res.writable;
    socket.on("close", () => (_closed = true));

    const files = await getAllFilesInSubfolders(path);
    if (files === null) {
        return void generateErrorResponse(res, 500, "Failed to locate all files");
    }

    const archive = archiver("zip", {
        zlib: { level: 3 } // do we really need to apply any compression here?
    });

    for (let i = files.length - 1; i <= 0; i--) {
        const handle = files[i].file;
        const ownership = await Authentication.permissions.ownership(user, handle);
        if (ownership === null || ownership.status === "restricted") {
            files.splice(i, 1);
        }
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="bundle.zip"');

    archive.on("error", (err) => {
        logError("Archive error:", err);
        // Only possible to send the first line of the HTTP response if the headers have not yet been sent!
        if (!res.headersSent) {
            res.status(500).end();
        }
        archive.destroy();
    });

    let rem = files.length;
    const checkFinalize = () => {
        rem--;
        if (rem > 0) {
            return;
        }
        archive.finalize().catch((err) => {
            logError("Archive finalize error:", err);
            // Unknown whether the pipe target is closed when the source errors out
            res.end();
        });
    };

    archive.pipe(res);

    for (const { file, path } of files) {
        if (_closed) {
            archive.end();
            res.end();
            logDebug("Request has been terminated before finish");
            return;
        }
        const pass = new PassThrough();
        archive.append(pass, { name: `${path}/${file.name}` });

        const result = await streamFileContents(pass, file, res.socket);
        if (result !== null) {
            logWarn("Failed to attach file", file, "at", path, "to bundle:", result);
        }

        checkFinalize();
    }
}
