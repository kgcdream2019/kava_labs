import { LndSettlementEngine } from './settlement/lnd';
import { XrpPaychanSettlementEngine } from './settlement/xrp-paychan';
import { MachinomySettlementEngine } from './settlement/machinomy';
export declare enum SettlementEngineType {
    /** Lightning daeman */
    Lnd = "lnd",
    /** Machinomy Ethereum unidirectional payment channels */
    Machinomy = "machinomy",
    /** XRP ledger native payment channels */
    XrpPaychan = "xrp-paychan"
    //newly added code for xmrd
    , XmrdPaychan = "xmrd-paychan"
    //end
}
export interface SettlementEngine {
    readonly settlerType: SettlementEngineType;
}
export declare type SettlementEngines = (LndSettlementEngine | MachinomySettlementEngine | XrpPaychanSettlementEngine) & SettlementEngine;
export declare const closeEngine: (settler: SettlementEngines) => Promise<void>;
