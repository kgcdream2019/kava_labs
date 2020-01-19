import BigNumber from 'bignumber.js';
export { connectCoinCap } from './api/coincap';
export interface RateApi {
    getPrice: (symbol: string) => BigNumber;
    disconnect: () => Promise<void>;
}
export interface AssetUnit {
    readonly symbol: string;
    readonly exchangeScale: number;
    readonly accountScale: number;
    readonly scale: number;
}
export interface AssetQuantity extends AssetUnit {
    readonly amount: BigNumber;
}
export declare const baseUnit: (unit: AssetUnit) => AssetUnit;
export declare const exchangeUnit: (unit: AssetUnit) => AssetUnit;
export declare const accountUnit: (unit: AssetUnit) => AssetUnit;
export interface ConvertQuantity {
    (unit: AssetUnit, amount: BigNumber.Value): AssetQuantity;
    (unit: AssetQuantity): AssetQuantity;
}
export declare const baseQuantity: ConvertQuantity;
export declare const exchangeQuantity: ConvertQuantity;
export declare const accountQuantity: ConvertQuantity;
export declare const convert: (source: AssetQuantity, dest: AssetUnit, api?: RateApi | undefined) => AssetQuantity;
export declare const getRate: (source: AssetUnit, dest: AssetUnit, api?: RateApi | undefined) => BigNumber;
