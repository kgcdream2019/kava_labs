/// <reference types="node" />
export declare const defaultDataHandler: () => Promise<Buffer>;
export declare const defaultIlpPrepareHandler: () => Promise<{
    code: string;
    message: string;
    triggeredBy: string;
    data: Buffer;
}>;
export declare const defaultMoneyHandler: () => Promise<never>;
