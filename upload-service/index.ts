import express, { type Request, type Response } from "express";
import multer from "multer";
import { getCurrentUpload } from "./state.ts";
import { patterns } from "../common/patterns.ts";
import { Socket } from "./Socket.ts";
import dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/.env` });

export function getEnviromentVariables() {
    const { PASSWORD, SOCKET_ADDRESS, ADDRESS } = process.env;
    if (!PASSWORD || !SOCKET_ADDRESS || !ADDRESS) throw new ReferenceError("Missing environment variables");
    return { password: PASSWORD, socketAddress: SOCKET_ADDRESS, address: ADDRESS };
}

const app = express();
const upload = multer();
app.post("/", upload.single("file"), onFileUpload);

const socket = new Socket();

async function onFileUpload(req: Request, res: Response) {
    const data = getCurrentUpload();
    if (!data) {
        res.status(400).json({ error: "No file is uploading" });
        return;
    }
    const type = req.headers["content-type"];
    if (!type || !patterns.multipart.test(type)) {
        res.status(400).json({ error: "Invalid content-type" });
        return;
    }
    const { id } = req.body;
    if (id !== data.metadata.upload_id) {
        res.status(400).json({ error: "Invalid upload ID" });
        return;
    }

    const file = req.file;
    if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
    }
}

app.listen(process.env.PORT, () => console.log("Upload service is listening"));
