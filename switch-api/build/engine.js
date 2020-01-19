"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const xrp_paychan_1 = require("./settlement/xrp-paychan");
var SettlementEngineType;
(function (SettlementEngineType) {
    /** Lightning daeman */
    SettlementEngineType["Lnd"] = "lnd";
    /** Machinomy Ethereum unidirectional payment channels */
    SettlementEngineType["Machinomy"] = "machinomy";
    /** XRP ledger native payment channels */
    SettlementEngineType["XrpPaychan"] = "xrp-paychan";
    //newly added code for xmrd
    SettlementEngineType["XmrdPaychan"] = "xmrd-paychan";
    //end
})(SettlementEngineType = exports.SettlementEngineType || (exports.SettlementEngineType = {}));
exports.closeEngine = async (settler) => {
    switch (settler.settlerType) {
        case SettlementEngineType.XrpPaychan:
            return xrp_paychan_1.closeXrpPaychanEngine(settler);
    }
};
//# sourceMappingURL=engine.js.map