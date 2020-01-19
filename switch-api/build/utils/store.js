"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MemoryStore {
    constructor(store = {}, prefix = '') {
        this.store = store;
        this.prefix = prefix;
    }
    /** Async actions (for plugins to support DB) */
    async get(key) {
        return this.getSync(key);
    }
    async put(key, val) {
        this.putSync(key, val);
    }
    async del(key) {
        this.delSync(key);
    }
    /** Synchronous actions (in-memory only) */
    getSync(key) {
        return this.store[this.prefix + key];
    }
    putSync(key, val) {
        this.store[this.prefix + key] = val;
    }
    delSync(key) {
        delete this.store[this.prefix + key];
    }
}
exports.MemoryStore = MemoryStore;
//# sourceMappingURL=store.js.map