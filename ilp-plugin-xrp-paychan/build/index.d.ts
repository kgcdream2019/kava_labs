/// <reference types="node" />
import BigNumber from 'bignumber.js';
import { EventEmitter2 } from 'eventemitter2';
import { IlpPluginBtpConstructorOptions } from 'ilp-plugin-btp';
import XrpAccount from './account';
import { XrpClientPlugin } from './plugins/client';
import { XrpServerPlugin, MiniAccountsOpts } from './plugins/server';
import { DataHandler, Logger, MoneyHandler, PluginInstance, PluginServices } from './types/plugin';
import { remainingInChannel, spentFromChannel, PaymentChannel, ClaimablePaymentChannel } from './utils/channel';
import { StoreWrapper } from './utils/store';
import { RippleAPI } from 'ripple-lib';
export { XrpAccount, remainingInChannel, spentFromChannel, PaymentChannel, ClaimablePaymentChannel };
export interface XrpPluginOpts extends MiniAccountsOpts, IlpPluginBtpConstructorOptions {
    role: 'client' | 'server';
    xrpSecret: string;
    xrpServer?: string;
    outgoingChannelAmount?: BigNumber.Value;
    minIncomingChannelAmount?: BigNumber.Value;
    minIncomingDisputePeriod?: BigNumber.Value;
    outgoingDisputePeriod?: BigNumber.Value;
    maxPacketAmount?: BigNumber.Value;
    channelWatcherInterval?: BigNumber.Value;
}
export default class XrpPlugin extends EventEmitter2 implements PluginInstance {
    static readonly version = 2;
    readonly _plugin: XrpClientPlugin | XrpServerPlugin;
    readonly _accounts: Map<string, XrpAccount>;
    readonly _xrpSecret: string;
    readonly _xrpAddress: string;
    readonly _api: RippleAPI;
    readonly _outgoingChannelAmount: BigNumber;
    readonly _minIncomingChannelAmount: BigNumber;
    readonly _outgoingDisputePeriod: BigNumber;
    readonly _minIncomingDisputePeriod: BigNumber;
    readonly _maxPacketAmount: BigNumber;
    readonly _maxBalance: BigNumber;
    readonly _channelWatcherInterval: BigNumber;
    readonly _store: StoreWrapper;
    readonly _log: Logger;
    _dataHandler: DataHandler;
    _moneyHandler: MoneyHandler;
    _txPipeline: Promise<void>;
    constructor({ role, xrpSecret, xrpServer, outgoingChannelAmount, minIncomingChannelAmount, outgoingDisputePeriod, minIncomingDisputePeriod, maxPacketAmount, channelWatcherInterval, ...opts }: XrpPluginOpts, { log, store }?: PluginServices);
    _loadAccount(accountName: string): Promise<XrpAccount>;
    _queueTransaction<T>(sendTransaction: () => Promise<T>): Promise<T>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    sendData(data: Buffer): Promise<Buffer>;
    sendMoney(amount: string): Promise<void>;
    registerDataHandler(dataHandler: DataHandler): void;
    deregisterDataHandler(): void;
    registerMoneyHandler(moneyHandler: MoneyHandler): void;
    deregisterMoneyHandler(): void;
}
