/// <reference types="node" />
import XrpAccount from '../account';
import BtpPlugin, { BtpPacket, BtpSubProtocol, IlpPluginBtpConstructorOptions } from 'ilp-plugin-btp';
import { PluginInstance, PluginServices } from '../types/plugin';
export interface XrpClientOpts extends IlpPluginBtpConstructorOptions {
    getAccount: (accountName: string) => XrpAccount;
    loadAccount: (accountName: string) => Promise<XrpAccount>;
}
export declare class XrpClientPlugin extends BtpPlugin implements PluginInstance {
    private getAccount;
    private loadAccount;
    constructor({ getAccount, loadAccount, ...opts }: XrpClientOpts, { log }: PluginServices);
    _sendMessage(accountName: string, message: BtpPacket): Promise<import("ilp-plugin-btp").BtpPacketData>;
    _connect(): Promise<void>;
    _handleData(from: string, message: BtpPacket): Promise<BtpSubProtocol[]>;
    sendData(buffer: Buffer): Promise<Buffer>;
    sendMoney(amount: string): Promise<void>;
    _disconnect(): Promise<void>;
}
