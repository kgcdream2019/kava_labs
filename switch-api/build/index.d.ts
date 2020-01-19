import { AssetQuantity, RateApi } from '@kava-labs/crypto-rate-utils';
import BigNumber from 'bignumber.js';
import { AssetCode } from './assets';
import { CredentialConfigs, ReadyCredentials } from './credential';
import { SettlementEngineType } from './engine';
import { LndSettlementEngine } from './settlement/lnd';
import { MachinomySettlementEngine } from './settlement/machinomy';
import { XrpPaychanSettlementEngine } from './settlement/xrp-paychan';
import { AuthorizeDeposit, AuthorizeWithdrawal, BaseUplinkConfig, ReadyUplinks } from './uplink';
declare type ThenArg<T> = T extends Promise<infer U> ? U : T;
export declare type IlpSdk = ThenArg<ReturnType<typeof connect>>;
export declare enum LedgerEnv {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Local = "local"
}
export declare type UplinkConfigs = CredentialConfigs & {
    readonly assetType?: AssetCode;
};
export { SettlementEngineType, ReadyUplinks };
export interface State {
    readonly ledgerEnv: LedgerEnv;
    readonly rateBackend: RateApi;
    readonly maxInFlightUsd: AssetQuantity;
    readonly settlers: {
        readonly [SettlementEngineType.Lnd]: LndSettlementEngine;
        readonly [SettlementEngineType.Machinomy]: MachinomySettlementEngine;
        readonly [SettlementEngineType.XrpPaychan]: XrpPaychanSettlementEngine;
    };
    credentials: ReadyCredentials[];
    uplinks: ReadyUplinks[];
}
export interface ConfigSchema {
    readonly ledgerEnv?: LedgerEnv;
    readonly credentials: CredentialConfigs[];
    readonly uplinks: BaseUplinkConfig[];
}
export declare type MultiConfigSchema = {
    readonly [LedgerEnv.Mainnet]?: ConfigSchema;
    readonly [LedgerEnv.Testnet]?: ConfigSchema;
    readonly [LedgerEnv.Local]?: ConfigSchema;
};
export declare const connect: (ledgerEnv?: LedgerEnv, config?: MultiConfigSchema | ConfigSchema) => Promise<{
    state: State;
    add(uplinkConfig: UplinkConfigs): Promise<ReadyUplinks>;
    deposit({ uplink, amount, authorize }: {
        readonly uplink: ReadyUplinks;
        readonly amount: BigNumber;
        readonly authorize?: AuthorizeDeposit | undefined;
    }): Promise<void>;
    withdraw({ uplink, authorize }: {
        readonly uplink: ReadyUplinks;
        readonly authorize?: AuthorizeWithdrawal | undefined;
    }): Promise<void>;
    remove(uplink: ReadyUplinks): Promise<void>;
    streamMoney: ({ amount, source, dest, slippage }: import("./services/switch").StreamMoneyOpts) => Promise<void>;
    getBaseBalance: (uplink: ReadyUplinks) => Promise<AssetQuantity>;
    serializeConfig(): MultiConfigSchema;
    disconnect(): Promise<void>;
}>;
