import XrpAccount from '../account';
import { PluginInstance, PluginServices } from '../types/plugin';
import MiniAccountsPlugin from 'ilp-plugin-mini-accounts';
import { ServerOptions } from 'ws';
import { IldcpResponse } from 'ilp-protocol-ildcp';
import { BtpPacket, BtpSubProtocol } from 'ilp-plugin-btp';
import { IlpPacket, IlpPrepare, Type } from 'ilp-packet';
export interface MiniAccountsOpts {
    port?: number;
    wsOpts?: ServerOptions;
    debugHostIldcpInfo?: IldcpResponse;
    allowedOrigins?: string[];
}
export interface XrpServerOpts extends MiniAccountsOpts {
    getAccount: (accountName: string) => XrpAccount;
    loadAccount: (accountName: string) => Promise<XrpAccount>;
}
export declare class XrpServerPlugin extends MiniAccountsPlugin implements PluginInstance {
    private getAccount;
    private loadAccount;
    constructor({ getAccount, loadAccount, ...opts }: XrpServerOpts, api: PluginServices);
    _sendMessage(accountName: string, message: BtpPacket): Promise<import("ilp-plugin-btp").BtpPacketData>;
    _connect(address: string, message: BtpPacket): Promise<void>;
    _handleCustomData: (from: string, message: BtpPacket) => Promise<BtpSubProtocol[]>;
    _handlePrepareResponse: (destination: string, responsePacket: IlpPacket, preparePacket: {
        type: Type.TYPE_ILP_PREPARE;
        typeString?: "ilp_prepare" | undefined;
        data: IlpPrepare;
    }) => Promise<void>;
    sendMoney(): Promise<void>;
    _close(from: string): Promise<void>;
}
