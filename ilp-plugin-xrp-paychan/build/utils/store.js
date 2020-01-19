"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MemoryStore {
    constructor() {
        this._store = new Map();
    }
    async get(k) {
        return this._store.get(k);
    }
    async put(k, v) {
        this._store.set(k, v);
    }
    async del(k) {
        this._store.delete(k);
    }
}
exports.MemoryStore = MemoryStore;
class StoreWrapper {
    constructor(store) {
        this._store = store;
        this._cache = new Map();
        this._write = Promise.resolve();
    }
    async load(key) {
        return this._load(key, false);
    }
    async loadObject(key) {
        return this._load(key, true);
    }
    async _load(key, parse) {
        if (!this._store)
            return;
        if (this._cache.has(key))
            return;
        const value = await this._store.get(key);
        if (!this._cache.has(key)) {
            this._cache.set(key, parse && value ? JSON.parse(value) : value);
        }
    }
    unload(key) {
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }
    }
    get(key) {
        const val = this._cache.get(key);
        if (typeof val === 'undefined' || typeof val === 'string')
            return val;
        throw new Error('StoreWrapper#get: unexpected type for key=' + key);
    }
    getObject(key) {
        const val = this._cache.get(key);
        if (typeof val === 'undefined' || typeof val === 'object')
            return val;
        throw new Error('StoreWrapper#getObject: unexpected type for key=' + key);
    }
    set(key, value) {
        this._cache.set(key, value);
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
        this._write = this._write.then(() => {
            if (this._store) {
                return this._store.put(key, valueStr);
            }
        });
    }
    delete(key) {
        this._cache.delete(key);
        this._write = this._write.then(() => {
            if (this._store) {
                return this._store.del(key);
            }
        });
    }
    setCache(key, value) {
        this._cache.set(key, value);
    }
    close() {
        return this._write;
    }
}
exports.StoreWrapper = StoreWrapper;
//# sourceMappingURL=store.js.map