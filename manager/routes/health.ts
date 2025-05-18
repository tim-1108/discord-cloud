import type { Request, Response } from "express";

export default function handleRequest(_: Request, res: Response): void {
    res.status(204).send();
}
