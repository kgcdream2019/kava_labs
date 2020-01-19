"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("./engine");
// TODO If this is imported from '.', it causes a runtime TypeError that I think is caused by circular dependency resolution
var LedgerEnv;
(function (LedgerEnv) {
    LedgerEnv["Mainnet"] = "mainnet";
    LedgerEnv["Testnet"] = "testnet";
    LedgerEnv["Local"] = "local";
})(LedgerEnv || (LedgerEnv = {}));
exports.ethAsset = {
    symbol: 'ETH',
    exchangeScale: 18,
    accountScale: 9,
    scale: 0
};
exports.daiAsset = {
    symbol: 'DAI',
    exchangeScale: 18,
    accountScale: 9,
    scale: 0
};
exports.xrpAsset = {
    symbol: 'XRP',
    exchangeScale: 6,
    accountScale: 0,
    scale: 0
};
exports.btcAsset = {
    symbol: 'BTC',
    exchangeScale: 8,
    accountScale: 0,
    scale: 0
};
exports.usdAsset = {
    symbol: 'USD',
    exchangeScale: 2,
    accountScale: 0,
    scale: 0
};
exports.getAssetScale = (asset) => Math.abs(asset.exchangeScale - asset.accountScale);
exports.getAsset = (symbol) => ({
    BTC: exports.btcAsset,
    ETH: exports.ethAsset,
    XRP: exports.xrpAsset,
    DAI: exports.daiAsset
}[symbol]);
exports.CONNECTOR_LIST = [
    /** Mainnet connectors */
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Mainnet,
        assetType: 'BTC',
        settlerType: engine_1.SettlementEngineType.Lnd,
        btp: token => `btp+wss://:${token}@ilp.kava.io/btc`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Mainnet,
        assetType: 'ETH',
        settlerType: engine_1.SettlementEngineType.Machinomy,
        btp: token => `btp+wss://:${token}@ilp.kava.io/eth`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Mainnet,
        assetType: 'XRP',
        settlerType: engine_1.SettlementEngineType.XrpPaychan,
        btp: token => `btp+wss://:${token}@ilp.kava.io/xrp`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Mainnet,
        assetType: 'DAI',
        settlerType: engine_1.SettlementEngineType.Machinomy,
        btp: token => `btp+wss://:${token}@ilp.kava.io/dai`
    },
    /** Testnet connectors */
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Testnet,
        assetType: 'BTC',
        settlerType: engine_1.SettlementEngineType.Lnd,
        btp: token => `btp+wss://:${token}@test.ilp.kava.io/btc`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Testnet,
        assetType: 'ETH',
        settlerType: engine_1.SettlementEngineType.Machinomy,
        btp: token => `btp+wss://:${token}@test.ilp.kava.io/eth`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Testnet,
        assetType: 'XRP',
        settlerType: engine_1.SettlementEngineType.XrpPaychan,
        btp: token => `btp+wss://:${token}@test.ilp.kava.io/xrp`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Testnet,
        assetType: 'DAI',
        settlerType: engine_1.SettlementEngineType.Machinomy,
        btp: token => `btp+wss://:${token}@test.ilp.kava.io/dai`
    },
    /** Local connectors */
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Local,
        assetType: 'BTC',
        settlerType: engine_1.SettlementEngineType.Lnd,
        btp: token => `btp+ws://:${token}@localhost:7441`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Local,
        assetType: 'ETH',
        settlerType: engine_1.SettlementEngineType.Machinomy,
        btp: token => `btp+ws://:${token}@localhost:7442`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Local,
        assetType: 'XRP',
        settlerType: engine_1.SettlementEngineType.XrpPaychan,
        btp: token => `btp+ws://:${token}@localhost:7443`
    },
    {
        operatorName: 'Kava Labs',
        ledgerEnv: LedgerEnv.Local,
        assetType: 'DAI',
        settlerType: engine_1.SettlementEngineType.Machinomy,
        btp: token => `btp+ws://:${token}@localhost:7444`
    }
];
// TODO Remove local connectors and provide config option instead
//# sourceMappingURL=assets.js.map