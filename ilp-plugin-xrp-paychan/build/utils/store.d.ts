export interface Store {
    get: (key: string) => Promise<string | void>;
    put: (key: string, value: string) => Promise<void>;
    del: (key: string) => Promise<void>;
}
export declare class MemoryStore implements Store {
    private _store;
    constructor();
    get(k: string): Promise<string | undefined>;
    put(k: string, v: string): Promise<void>;
    del(k: string): Promise<void>;
}
export declare class StoreWrapper {
    private _store?;
    private _cache;
    private _write;
    constructor(store: Store);
    load(key: string): Promise<void>;
    loadObject(key: string): Promise<void>;
    private _load;
    unload(key: string): void;
    get(key: string): string | void;
    getObject(key: string): object | void;
    set(key: string, value: string | object): void;
    delete(key: string): void;
    setCache(key: string, value: string): void;
    close(): Promise<void>;
}
