"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const eventemitter2_1 = require("eventemitter2");
class ReducerQueue extends eventemitter2_1.EventEmitter2 {
    constructor(initialState) {
        super();
        this.queue = [];
        this.cache = initialState;
        this.waterfall = Promise.resolve(initialState);
        this.emit('data', initialState);
    }
    add(task, priority = 0) {
        const done = new Promise((resolve, reject) => {
            const run = (state) => task(state)
                .then(state => {
                resolve(state);
                return state;
            })
                .catch(err => {
                reject(err);
                return state;
            });
            const element = { run, priority };
            const index = lowerBound(this.queue, element, (a, b) => b.priority - a.priority);
            this.queue.splice(index, 0, element);
        });
        this.waterfall = this.waterfall.then(state => this.tryToRunAnother(state));
        return done;
    }
    clear() {
        this.queue = [];
        return this.waterfall;
    }
    get state() {
        return this.cache;
    }
    toJSON() {
        return this.cache;
    }
    async tryToRunAnother(state) {
        const next = this.queue.shift();
        if (!next) {
            return state;
        }
        const newState = await next.run(state);
        this.cache = newState;
        this.emit('data', newState);
        return newState;
    }
}
exports.default = ReducerQueue;
const lowerBound = (array, value, comp) => {
    let first = 0;
    let count = array.length;
    while (count > 0) {
        const step = (count / 2) | 0;
        let it = first + step;
        if (comp(array[it], value) <= 0) {
            first = ++it;
            count -= step + 1;
        }
        else {
            count = step;
        }
    }
    return first;
};
//# sourceMappingURL=queue.js.map