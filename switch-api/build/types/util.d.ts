interface Flavoring<FlavorT> {
    readonly _type?: FlavorT;
}
export declare type Flavor<T, FlavorT> = T & Flavoring<FlavorT>;
export declare type Brand<K, T> = K & {
    readonly __brand: T;
};
export {};
