/// <reference types="node" />
import BigNumber from 'bignumber.js';
import { DataHandler, Logger, Plugin } from '../types/plugin';
import { MemoryStore } from './store';
import { BehaviorSubject } from 'rxjs';
export interface PluginWrapperOpts {
    readonly plugin: Plugin;
    readonly maxBalance?: BigNumber.Value;
    readonly maxPacketAmount: BigNumber.Value;
    readonly log: Logger;
    readonly assetCode: string;
    readonly assetScale: number;
    readonly store: MemoryStore;
}
export declare class PluginWrapper {
    static readonly version = 2;
    private readonly plugin;
    private dataHandler;
    /**
     * Amount owed *by us* to our peer for **packets we've sent to them** (outgoing balance)
     * - Positive amount indicates we're indebted to the peer and need to pay them for packets they've already forwarded
     * - Negative amount indicates we've prefunded the peer and have as much credit available to spend
     *
     * TRIGGERS:
     * - Outgoing settlements to peer **decrease** the amount we owe to them
     * - Outgoing PREPARE packets to the peer **increase** the amount we owe to them,
     *   but only *after* we receive a FULFILL packet
     *
     * EFFECTS:
     * - Determines when outgoing settlements to peer occur and for how much
     */
    readonly payableBalance$: BehaviorSubject<BigNumber>;
    /**
     * Amount owed *to us* by our peer for **their packets we've forwarded** (incoming balance)
     * - Positive amount indicates our peer is indebted to us for packets we've already forwarded
     * - Negative amount indicates our peer has prefunded us and has as much credit available to spend
     *
     * TRIGGERS:
     * - Incoming settlements from the peer **decrease** the amount they owe to us
     * - Incoming PREPARE packets from the peer immediately **increase** the amount they owe to us,
     *   unless we respond with a REJECT (e.g. we decline to forward it, or it's rejected upstream).
     *
     * EFFECTS:
     * - Determines if an incoming PREPARE is forwarded/cleared
     */
    readonly receivableBalance$: BehaviorSubject<BigNumber>;
    /**
     * Positive maximum amount of packets we'll forward on credit before the peer must settle up
     * - Since it's credit extended, if the peer went offline/disappeared, we'd still be owed the money
     */
    private readonly maxBalance;
    private readonly maxPacketAmount;
    private readonly store;
    private readonly log;
    private readonly assetCode;
    private readonly assetScale;
    constructor({ plugin, maxBalance, maxPacketAmount, log, store, assetCode, assetScale }: PluginWrapperOpts);
    sendData(data: Buffer): Promise<Buffer>;
    sendMoney(amount: string): Promise<void>;
    private handleMoney;
    private handleData;
    registerDataHandler(handler: DataHandler): void;
    deregisterDataHandler(): void;
    private format;
}
