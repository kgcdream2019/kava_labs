"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const assets_1 = require("./assets");
const credential_1 = require("./credential");
const engine_1 = require("./engine");
exports.SettlementEngineType = engine_1.SettlementEngineType;
const switch_1 = require("./services/switch");
const lnd_1 = require("./settlement/lnd");
const machinomy_1 = require("./settlement/machinomy");
const xrp_paychan_1 = require("./settlement/xrp-paychan");
const uplink_1 = require("./uplink");
var LedgerEnv;
(function (LedgerEnv) {
    LedgerEnv["Mainnet"] = "mainnet";
    LedgerEnv["Testnet"] = "testnet";
    LedgerEnv["Local"] = "local";
})(LedgerEnv = exports.LedgerEnv || (exports.LedgerEnv = {}));
const isMultiConfig = (o) => !('credentials' in o) && !('uplinks' in o);
exports.connect = async (ledgerEnv = LedgerEnv.Testnet, config = {}) => {
    const state = {
        ledgerEnv,
        rateBackend: await crypto_rate_utils_1.connectCoinCap(),
        maxInFlightUsd: crypto_rate_utils_1.exchangeQuantity(assets_1.usdAsset, 0.1),
        settlers: {
            [engine_1.SettlementEngineType.Lnd]: await lnd_1.Lnd.setupEngine(ledgerEnv),
            [engine_1.SettlementEngineType.Machinomy]: await machinomy_1.Machinomy.setupEngine(ledgerEnv),
            [engine_1.SettlementEngineType.XrpPaychan]: await xrp_paychan_1.XrpPaychan.setupEngine(ledgerEnv)
            //newly added code for xmrd
            , [engine_1.SettlementEngineType.XmrdPaychan]: await xmrd_paychan_1.XmrdPaychan.setupEngine(ledgerEnv)
            //end
        },
        credentials: [],
        uplinks: []
    };
    // If the provided config is older (not multi-environment), convert it to a multi-environment config
    const baseConfig = isMultiConfig(config)
        ? config
        : {
            [config.ledgerEnv || ledgerEnv]: config
        };
    /** Configuration for the environment of this instance (testnet, mainnet, etc) */
    const envConfig = baseConfig[ledgerEnv];
    if (envConfig) {
        state.credentials = await Promise.all(envConfig.credentials.map(cred => credential_1.setupCredential(cred)(state)));
        // TODO Handle error cases if the uplinks fail to connect
        state.uplinks = await Promise.all(envConfig.uplinks.map(uplinkConfig => {
            // TODO What if, for some reason, the credential doesn't exist?
            const cred = credential_1.getCredential(state)(uplinkConfig.credentialId);
            return uplink_1.connectUplink(state)(cred)(uplinkConfig);
        }));
    }
    // TODO Create a composite "id" for uplinks based on serverUri, settlerType & credentialId?
    return {
        state,
        async add(uplinkConfig) {
            const { assetType, ...credentialConfig } = uplinkConfig;
            const readyCredential = await credential_1.getOrCreateCredential(state)(credentialConfig);
            const readyUplink = await uplink_1.createUplink(state, readyCredential, assetType);
            state.uplinks = [...state.uplinks, readyUplink]; // TODO What if the uplink is a duplicate? (throws?)
            return readyUplink;
        },
        async deposit({ uplink, amount, authorize = () => Promise.resolve() }) {
            const internalUplink = state.uplinks.filter(uplink_1.isThatUplink(uplink))[0];
            const internalDeposit = uplink_1.depositToUplink(internalUplink);
            return (internalDeposit &&
                internalDeposit(state)({
                    amount,
                    authorize
                }));
        },
        async withdraw({ uplink, authorize = () => Promise.resolve() }) {
            const internalUplink = state.uplinks.filter(uplink_1.isThatUplink(uplink))[0];
            const internalWithdraw = uplink_1.withdrawFromUplink(internalUplink);
            if (internalWithdraw) {
                const checkWithdraw = () => internalUplink.totalReceived$.value.isZero() &&
                    internalUplink.totalSent$.value.isZero()
                    ? Promise.resolve()
                    : Promise.reject();
                return internalWithdraw(authorize).then(checkWithdraw, checkWithdraw);
            }
        },
        async remove(uplink) {
            // Remove the uplink
            const internalUplink = state.uplinks.find(uplink_1.isThatUplink(uplink));
            if (!internalUplink) {
                return;
            }
            await uplink_1.closeUplink(internalUplink);
            state.uplinks = state.uplinks.filter(el => !uplink_1.isThatUplink(uplink)(el));
            // Remove the credential
            const credentialsToClose = state.credentials.filter(credential_1.isThatCredentialId(internalUplink.credentialId, uplink.settlerType));
            await Promise.all(credentialsToClose.map(credential_1.closeCredential));
            state.credentials = state.credentials.filter(someCredential => !credentialsToClose.includes(someCredential));
        },
        streamMoney: switch_1.streamMoney(state),
        getBaseBalance: uplink_1.getBaseBalance(state),
        serializeConfig() {
            return {
                ...baseConfig,
                [ledgerEnv]: {
                    uplinks: this.state.uplinks.map(uplink => uplink.config),
                    credentials: this.state.credentials.map(credential_1.credentialToConfig)
                }
            };
        },
        // TODO Should disconnecting the API prevent other operations from occuring? (they may not work anyways)
        async disconnect() {
            await Promise.all(state.uplinks.map(uplink_1.closeUplink));
            await Promise.all(state.credentials.map(credential_1.closeCredential));
            await Promise.all(Object.values(state.settlers).map(engine_1.closeEngine));
        }
    };
};
//# sourceMappingURL=index.js.map