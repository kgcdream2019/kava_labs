import { AssetQuantity } from '@kava-labs/crypto-rate-utils';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import EthereumPlugin, { EthereumAccount } from 'ilp-plugin-ethereum';
import { State } from '..';
import { SettlementEngine, SettlementEngineType } from '../engine';
import { AuthorizeDeposit, AuthorizeWithdrawal, BaseUplink, BaseUplinkConfig, ReadyUplink } from '../uplink';
declare enum LedgerEnv {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Local = "local"
}
/**
 * ------------------------------------
 * SETTLEMENT ENGINE
 * ------------------------------------
 */
export interface MachinomySettlementEngine extends SettlementEngine {
    readonly settlerType: SettlementEngineType.Machinomy;
    readonly ethereumProvider: ethers.providers.Provider;
    readonly fetchGasPrice?: () => Promise<BigNumber>;
}
export declare const setupEngine: (ledgerEnv: LedgerEnv) => Promise<MachinomySettlementEngine>;
/**
 * ------------------------------------
 * CREDENTIAL
 * ------------------------------------
 */
export interface ValidatedEthereumPrivateKey {
    readonly settlerType: SettlementEngineType.Machinomy;
    readonly privateKey: string;
}
export declare type ReadyEthereumCredential = {
    readonly settlerType: SettlementEngineType.Machinomy;
    readonly privateKey: string;
    readonly address: string;
};
export declare const setupCredential: ({ privateKey, settlerType }: ValidatedEthereumPrivateKey) => () => Promise<ReadyEthereumCredential>;
export declare const uniqueId: (cred: ReadyEthereumCredential) => string;
export declare const configFromEthereumCredential: ({ address, ...config }: ReadyEthereumCredential) => ValidatedEthereumPrivateKey;
export declare const getBaseBalance: (settler: MachinomySettlementEngine, credential: ReadyEthereumCredential) => Promise<AssetQuantity>;
/**
 * ------------------------------------
 * UPLINK
 * ------------------------------------
 */
export interface MachinomyUplinkConfig extends BaseUplinkConfig {
    readonly settlerType: SettlementEngineType.Machinomy;
    readonly credential: ValidatedEthereumPrivateKey;
}
export interface MachinomyBaseUplink extends BaseUplink {
    readonly plugin: EthereumPlugin;
    readonly settlerType: SettlementEngineType.Machinomy;
    readonly pluginAccount: EthereumAccount;
}
export declare type ReadyMachinomyUplink = MachinomyBaseUplink & ReadyUplink;
export declare const connectUplink: (credential: ReadyEthereumCredential) => (state: State) => (config: BaseUplinkConfig) => Promise<MachinomyBaseUplink>;
export declare const deposit: (uplink: ReadyMachinomyUplink) => () => ({ amount, authorize }: {
    readonly amount: BigNumber;
    readonly authorize: AuthorizeDeposit;
}) => Promise<void>;
/**
 * ------------------------------------
 * SETTLEMENT MODULE
 * ------------------------------------
 */
export declare const Machinomy: {
    setupEngine: (ledgerEnv: LedgerEnv) => Promise<MachinomySettlementEngine>;
    setupCredential: ({ privateKey, settlerType }: ValidatedEthereumPrivateKey) => () => Promise<ReadyEthereumCredential>;
    uniqueId: (cred: ReadyEthereumCredential) => string;
    connectUplink: (credential: ReadyEthereumCredential) => (state: State) => (config: BaseUplinkConfig) => Promise<MachinomyBaseUplink>;
    deposit: (uplink: ReadyMachinomyUplink) => () => ({ amount, authorize }: {
        readonly amount: BigNumber;
        readonly authorize: AuthorizeDeposit;
    }) => Promise<void>;
    withdraw: (uplink: ReadyMachinomyUplink) => (authorize: AuthorizeWithdrawal) => Promise<void>;
    getBaseBalance: (settler: MachinomySettlementEngine, credential: ReadyEthereumCredential) => Promise<AssetQuantity>;
};
/**
 * Use the `fast` gasPrice per EthGasStation on mainnet
 * Fallback to Web3 eth_gasPrice RPC call if it fails
 */
export declare const fetchGasPrice: (ethereumProvider: ethers.providers.Provider) => () => Promise<BigNumber>;
export {};
