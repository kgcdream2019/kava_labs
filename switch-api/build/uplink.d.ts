import { AssetUnit, AssetQuantity } from '@kava-labs/crypto-rate-utils';
import BigNumber from 'bignumber.js';
import { Server as StreamServer } from 'ilp-protocol-stream';
import { BehaviorSubject } from 'rxjs';
import { State } from '.';
import { ReadyCredentials } from './credential';
import { SettlementEngineType } from './engine';
import { LndBaseUplink } from './settlement/lnd';
import { MachinomyBaseUplink } from './settlement/machinomy';
import { XrpPaychanBaseUplink } from './settlement/xrp-paychan';
import { DataHandler, IlpPrepareHandler, Plugin } from './types/plugin';
import { PluginWrapper } from './utils/middlewares';
import { SimpleStore } from './utils/store';
import { AssetCode } from './assets';
/** TODO The config to export should be *re-generated* each time by an uplink */
export interface BaseUplinkConfig {
    readonly settlerType: SettlementEngineType;
    /**
     * - A given settler (e.g. Machinomy) may have a default asset type, such as ETH
     */
    readonly assetType?: AssetCode;
    readonly credentialId: string;
    readonly stream: {
        /**
         * Deterministic generation of previous shared secrets so we can accept payments
         * - Encoded as a hex string
         */
        readonly serverSecret: string;
    };
    readonly plugin: {
        readonly btp: {
            readonly serverUri: string;
            readonly authToken: string;
        };
        readonly store: SimpleStore;
    };
}
export interface BaseUplink {
    readonly plugin: Plugin;
    readonly settlerType: SettlementEngineType;
    readonly asset: AssetUnit;
    readonly credentialId: string;
    /**
     * Amount of our *money* in layer 2 we have custody over,
     * immediately available for us to send to our peer
     */
    readonly outgoingCapacity$: BehaviorSubject<BigNumber>;
    /**
     * Amount of *money* our peer has custody over in layer 2,
     * immediately available for our peer to send to us
     */
    readonly incomingCapacity$: BehaviorSubject<BigNumber>;
    /**
     * Amount of *money* we've received in layer 2 that is *unavailble* to send
     * (money that we cannot directly send back to our peer)
     */
    readonly totalReceived$: BehaviorSubject<BigNumber>;
    /**
     * Amount of *money* we've sent in layer 2 that is *unavailable* to receive
     * (money that our peer cannot directly send back to us)
     */
    readonly totalSent$: BehaviorSubject<BigNumber>;
}
export declare type BaseUplinks = (LndBaseUplink | MachinomyBaseUplink | XrpPaychanBaseUplink) & BaseUplink;
export interface ReadyUplink extends BaseUplink {
    /** Wrapper plugin with balance logic to and perform accounting and limit the packets we fulfill */
    readonly pluginWrapper: PluginWrapper;
    /** Handle incoming packets from the endpoint sending money or trading */
    streamClientHandler: IlpPrepareHandler;
    /** Handle incoming packets from the endpoint receiving money from other parties */
    streamServerHandler: DataHandler;
    /** ILP address assigned from upstream connector */
    readonly clientAddress: string;
    /** Max amount to be sent unsecured at a given time */
    readonly maxInFlight: BigNumber;
    /** Total amount in layer 2 that can be claimed on layer 1 */
    readonly balance$: BehaviorSubject<BigNumber>;
    /** Total amount that we can send immediately over Interledger */
    readonly availableToSend$: BehaviorSubject<BigNumber>;
    /** Total amount that we could receive immediately over Interledger */
    readonly availableToReceive$: BehaviorSubject<BigNumber>;
    /** STREAM server to accept incoming payments from any Interledger client */
    readonly streamServer: StreamServer;
    /** TODO Eliminate this/rebuild config instead? */
    readonly config: BaseUplinkConfig;
}
export declare type ReadyUplinks = ReadyUplink & BaseUplinks;
/**
 * ------------------------------------
 * GETTING UPLINKS
 * ------------------------------------
 */
export declare const isThatUplink: (uplink: ReadyUplinks) => (someUplink: ReadyUplinks) => boolean;
export declare const createUplink: (state: State, readyCredential: ReadyCredentials, assetType?: "DAI" | "BTC" | "ETH" | "XRP" | undefined) => Promise<ReadyUplinks>;
export declare const connectBaseUplink: (credential: ReadyCredentials) => (state: State) => (config: BaseUplinkConfig) => Promise<BaseUplinks>;
export declare const connectUplink: (state: State) => (credential: ReadyCredentials) => (config: BaseUplinkConfig) => Promise<ReadyUplinks>;
/**
 * Register handlers for incoming packets, routing incoming payments to the STREAM
 * server, and all other packets to the internal switch/trading service.
 *
 * @param plugin ILP plugin to send and receive packets
 * @param clientAddress Resolved address of the root plugin, to differentiate connection tags
 * @param streamServerHandler Handler registered by the STREAM server for anonymous payments
 * @param streamClientHandler Handler for packets sent uplink -> uplink within the api itself
 *
 * EFFECT: registers handlers on the plugin
 */
export declare const setupHandlers: (plugin: PluginWrapper, clientAddress: string, streamServerHandler: DataHandler, streamClientHandler: IlpPrepareHandler) => void;
/**
 * Registers a handler for incoming packets not addressed to a
 * specific Stream connection, such as packets sent from another uplink
 *
 * EFFECT: mutates data handler mapped to the internal plugin
 */
export declare const registerPacketHandler: (handler: IlpPrepareHandler) => (uplink: ReadyUplinks) => void;
/**
 * Removes an existing handler for incoming packets not
 * addressed to a specific Stream connection
 *
 * EFFECT: mutates data handler mapped to the internal plugin
 */
export declare const deregisterPacketHandler: (uplink: ReadyUplinks) => void;
/** Convert the global max-in-flight amount to the local/native units (base units in plugin) */
export declare const getNativeMaxInFlight: (state: State, asset: AssetUnit) => Promise<BigNumber>;
/**
 * ------------------------------------
 * DEPOSITS & WITHDRAWALS
 * ------------------------------------
 */
export declare type AuthorizeDeposit = (params: {
    /** Total amount that will move from layer 1 to layer 2, in units of exchange */
    readonly value: BigNumber;
    /** Amount burned/lost as fee as a result of the transaction, in units of exchange */
    readonly fee: AssetQuantity;
}) => Promise<void>;
export declare type AuthorizeWithdrawal = (params: {
    /** Total amount that will move from layer 2 to layer 1, in units of exchange */
    readonly value: BigNumber;
    /** Amount burned/lost as fee as a result of the transaction, in units of exchange */
    readonly fee: AssetQuantity;
}) => Promise<void>;
export declare const depositToUplink: (uplink: ReadyUplinks) => ((state: State) => ({ amount, authorize }: {
    readonly amount: BigNumber;
    readonly authorize: AuthorizeDeposit;
}) => Promise<void>) | undefined;
export declare const withdrawFromUplink: (uplink: ReadyUplinks) => ((authorize: AuthorizeWithdrawal) => Promise<void>) | undefined;
/**
 * ------------------------------------
 * REMOVE UPLINK
 * ------------------------------------
 */
/**
 * Gracefully end the session so the uplink can no longer send/receive
 */
export declare const closeUplink: (uplink: ReadyUplinks) => Promise<void>;
/**
 * ------------------------------------
 * BASE LAYER BALANCE
 * ------------------------------------
 */
export declare const getBaseBalance: (state: State) => (uplink: ReadyUplinks) => Promise<AssetQuantity>;
/**
 * ------------------------------------
 * RXJS UTILS
 * ------------------------------------
 */
export declare const sumAll: import("rxjs").OperatorFunction<BigNumber[], BigNumber>;
export declare const subtract: import("rxjs").OperatorFunction<[BigNumber, BigNumber], BigNumber>;
export declare const distinctBigNum: import("rxjs").MonoTypeOperatorFunction<BigNumber>;
export declare const convertToExchangeUnit: (asset: AssetUnit) => import("rxjs").OperatorFunction<BigNumber, BigNumber>;
