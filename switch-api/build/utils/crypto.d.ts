/// <reference types="node" />
export declare const sha256: (preimage: string | Buffer) => Buffer;
export declare const generateSecret: () => Promise<Buffer>;
export declare const base64url: (buffer: Buffer) => string;
export declare const generateToken: () => Promise<string>;
