/// <reference types="node" />
import * as IlpStream from 'ilp-protocol-stream';
import { Plugin, DataHandler, IlpStreamPlugin } from '../types/plugin';
export declare const startStreamServer: (plugin: Plugin, registerDataHandler: (streamServerHandler: DataHandler) => void, streamSecret: Buffer) => Promise<IlpStream.Server>;
export declare const stopStreamServer: (server: IlpStream.Server) => Promise<void>;
export declare const wrapStreamPlugin: (plugin: Plugin, registerDataHandler: (handler: DataHandler) => void) => IlpStreamPlugin;
