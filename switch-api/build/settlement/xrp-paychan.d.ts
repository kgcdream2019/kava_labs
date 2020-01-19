import { AssetQuantity } from '@kava-labs/crypto-rate-utils';
import XrpPlugin, { XrpAccount } from '@kava-labs/ilp-plugin-xrp-paychan';
import BigNumber from 'bignumber.js';
import { RippleAPI } from 'ripple-lib';
import { Flavor } from '../types/util';
import { LedgerEnv, State } from '..';
import { SettlementEngine, SettlementEngineType } from '../engine';
import { AuthorizeDeposit, AuthorizeWithdrawal, BaseUplink, BaseUplinkConfig, ReadyUplink } from '../uplink';
/**
 * ------------------------------------
 * SETTLEMENT ENGINE
 * ------------------------------------
 */
export interface XrpPaychanSettlementEngine extends SettlementEngine {
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly api: RippleAPI;
}
export declare const closeXrpPaychanEngine: ({ api }: XrpPaychanSettlementEngine) => Promise<void>;
/**
 * ------------------------------------
 * CREDENTIAL
 * ------------------------------------
 */
export declare type UnvalidatedXrpSecret = {
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly secret: string;
};
export declare type ValidatedXrpSecret = Flavor<{
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly secret: string;
    readonly address: string;
}, 'ValidatedXrpSecret'>;
export declare const configFromXrpCredential: ({ address, ...cred }: Flavor<{
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly secret: string;
    readonly address: string;
}, "ValidatedXrpSecret">) => UnvalidatedXrpSecret;
export declare const getBaseBalance: (settler: XrpPaychanSettlementEngine, credential: Flavor<{
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly secret: string;
    readonly address: string;
}, "ValidatedXrpSecret">) => Promise<AssetQuantity>;
/**
 * ------------------------------------
 * UPLINK
 * ------------------------------------
 */
export interface XrpPaychanBaseUplink extends BaseUplink {
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly credentialId: string;
    readonly plugin: XrpPlugin;
    readonly pluginAccount: XrpAccount;
}
export declare type ReadyXrpPaychanUplink = XrpPaychanBaseUplink & ReadyUplink;
/**
 * ------------------------------------
 * SETTLEMENT MODULE
 * ------------------------------------
 */
export declare const XrpPaychan: {
    setupEngine: (ledgerEnv: LedgerEnv) => Promise<XrpPaychanSettlementEngine>;
    setupCredential: (cred: UnvalidatedXrpSecret) => (state: State) => Promise<Flavor<{
        readonly settlerType: SettlementEngineType.XrpPaychan;
        readonly secret: string;
        readonly address: string;
    }, "ValidatedXrpSecret">>;
    uniqueId: (cred: Flavor<{
        readonly settlerType: SettlementEngineType.XrpPaychan;
        readonly secret: string;
        readonly address: string;
    }, "ValidatedXrpSecret">) => string;
    connectUplink: (credential: Flavor<{
        readonly settlerType: SettlementEngineType.XrpPaychan;
        readonly secret: string;
        readonly address: string;
    }, "ValidatedXrpSecret">) => (state: State) => (config: BaseUplinkConfig) => Promise<XrpPaychanBaseUplink>;
    deposit: (uplink: ReadyXrpPaychanUplink) => (state: State) => ({ amount, authorize }: {
        readonly amount: BigNumber;
        readonly authorize: AuthorizeDeposit;
    }) => Promise<void>;
    withdraw: (uplink: ReadyXrpPaychanUplink) => (authorize: AuthorizeWithdrawal) => Promise<void>;
    getBaseBalance: (settler: XrpPaychanSettlementEngine, credential: Flavor<{
        readonly settlerType: SettlementEngineType.XrpPaychan;
        readonly secret: string;
        readonly address: string;
    }, "ValidatedXrpSecret">) => Promise<AssetQuantity>;
};
