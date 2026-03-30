import type {
    IPropertyManager,
    PropertyAttributes,
    PropertyBag,
    ResourcePropertyValue,
    Return2Callback,
    ReturnCallback,
    SimpleCallback
} from "webdav-server/lib/index.v2";
import { logInfo } from "../../common/logging";

type PropertyStore = {
    value: ResourcePropertyValue;
    attributes: PropertyAttributes;
};

export class PropertyManager implements IPropertyManager {
    private store = new Map<string, PropertyStore>();

    setProperty(name: string, value: ResourcePropertyValue, attributes: PropertyAttributes, callback: SimpleCallback): void {
        this.store.set(name, { value, attributes });
        logInfo(name, value, attributes);
        callback();
    }
    getProperty(name: string, callback: Return2Callback<ResourcePropertyValue, PropertyAttributes>): void {
        const property = this.store.get(name);
        logInfo(name);
        callback(property ? undefined : Error("does not exist"), property?.value, property?.attributes);
    }
    removeProperty(name: string, callback: SimpleCallback): void {
        const existed = this.store.delete(name);
        callback(existed ? undefined : Error("does not exist"));
    }
    getProperties(callback: ReturnCallback<PropertyBag>, byCopy?: boolean): void {
        const bag: PropertyBag = {};
        for (const [key, { value, attributes }] of this.store.entries()) {
            bag[key] = { value, attributes };
        }
        callback(undefined, bag);
    }
}
