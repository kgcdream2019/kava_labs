import { AssetUnit } from '@kava-labs/crypto-rate-utils';
import { SettlementEngineType } from './engine';
declare enum LedgerEnv {
    Mainnet = "mainnet",
    Testnet = "testnet",
    Local = "local"
}
export declare const ethAsset: AssetUnit;
export declare const daiAsset: AssetUnit;
export declare const xrpAsset: AssetUnit;
export declare const btcAsset: AssetUnit;
export declare const usdAsset: AssetUnit;
export declare const getAssetScale: (asset: AssetUnit) => number;
export declare const getAsset: (symbol: AssetCode) => AssetUnit;
export declare type AssetCode = 'BTC' | 'ETH' | 'DAI' | 'XRP';
export declare const CONNECTOR_LIST: {
    readonly operatorName: string;
    readonly ledgerEnv: LedgerEnv;
    readonly assetType: AssetCode;
    readonly settlerType: SettlementEngineType;
    readonly btp?: (token: string) => string;
}[];
export {};
