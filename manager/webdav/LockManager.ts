import type { ILockManager, Lock, ReturnCallback, SimpleCallback } from "webdav-server/lib/index.v2";
import { logInfo } from "../../common/logging";

export class LockManager implements ILockManager {
    private locks = new Map<string, Lock>();
    getLocks(callback: ReturnCallback<Lock[]>): void {
        callback(undefined, Array.from(this.locks.values()));
    }
    setLock(lock: Lock, callback: SimpleCallback): void {
        logInfo("Applied lock:", lock);
        callback();
    }
    removeLock(uuid: string, callback: ReturnCallback<boolean>): void {
        logInfo("Removed lock:", uuid);
        callback(undefined, this.locks.has(uuid));
        this.locks.delete(uuid);
    }
    getLock(uuid: string, callback: ReturnCallback<Lock>): void {
        logInfo(uuid);
        const lock = this.locks.get(uuid);
        callback(lock ? undefined : Error("does not exist"), lock);
    }
    refresh(uuid: string, timeoutSeconds: number, callback: ReturnCallback<Lock>): void {
        logInfo(uuid);
        const lock = this.locks.get(uuid);
        if (!lock) {
            return callback(Error("does not exist"));
        }
        lock.refresh(timeoutSeconds);
        callback(undefined, lock);
    }
}
