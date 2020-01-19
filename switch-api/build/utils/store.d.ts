export interface PluginStore {
    readonly get: (key: string) => Promise<string | void>;
    readonly put: (key: string, value: string) => Promise<void>;
    readonly del: (key: string) => Promise<void>;
}
export interface SimpleStore {
    [key: string]: string;
}
export declare class MemoryStore implements PluginStore {
    private readonly store;
    private readonly prefix;
    constructor(store?: SimpleStore, prefix?: string);
    /** Async actions (for plugins to support DB) */
    get(key: string): Promise<string | undefined>;
    put(key: string, val: string): Promise<void>;
    del(key: string): Promise<void>;
    /** Synchronous actions (in-memory only) */
    getSync(key: string): string | undefined;
    putSync(key: string, val: string): void;
    delSync(key: string): void;
}
