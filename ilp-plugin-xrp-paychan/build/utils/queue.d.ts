import { EventEmitter2 } from 'eventemitter2';
export default class ReducerQueue<T> extends EventEmitter2 {
    private cache;
    private waterfall;
    private queue;
    constructor(initialState: T);
    add(task: (state: T) => Promise<T>, priority?: number): Promise<T>;
    clear(): Promise<T>;
    readonly state: T;
    toJSON(): T;
    private tryToRunAnother;
}
