"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const axios_1 = __importDefault(require("axios"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ethers_1 = require("ethers");
const ilp_plugin_ethereum_1 = __importStar(require("ilp-plugin-ethereum"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const assets_1 = require("../assets");
const engine_1 = require("../engine");
const log_1 = __importDefault(require("../utils/log"));
const store_1 = require("../utils/store");
// TODO If this is imported from '..', it causes a runtime TypeError that I think is caused by circular dependency resolution
var LedgerEnv;
(function (LedgerEnv) {
    LedgerEnv["Mainnet"] = "mainnet";
    LedgerEnv["Testnet"] = "testnet";
    LedgerEnv["Local"] = "local";
})(LedgerEnv || (LedgerEnv = {}));
const DAI_MAINNET_ADDRESS = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';
const DAI_KOVAN_ADDRESS = '0xC4375B7De8af5a38a93548eb8453a498222C4fF2';
const TOKEN_ADDRESSES = [
    {
        symbol: 'DAI',
        ledgerEnv: LedgerEnv.Mainnet,
        tokenAddress: DAI_MAINNET_ADDRESS
    },
    {
        symbol: 'DAI',
        ledgerEnv: LedgerEnv.Testnet,
        tokenAddress: DAI_KOVAN_ADDRESS
    },
    {
        symbol: 'DAI',
        ledgerEnv: LedgerEnv.Local,
        tokenAddress: DAI_KOVAN_ADDRESS
    }
];
exports.setupEngine = async (ledgerEnv) => {
    const network = ledgerEnv === LedgerEnv.Mainnet ? 'homestead' : 'kovan';
    const ethereumProvider = ethers_1.ethers.getDefaultProvider(network);
    return {
        settlerType: engine_1.SettlementEngineType.Machinomy,
        ethereumProvider,
        fetchGasPrice: ledgerEnv === LedgerEnv.Mainnet
            ? exports.fetchGasPrice(ethereumProvider)
            : undefined
    };
};
/** Ensure that the given hex string begins with "0x" */
const ensureHexPrefix = (hexStr) => hexStr.startsWith('0x') ? hexStr : '0x' + hexStr;
const addressFromPrivate = (privateKey) => ethers_1.ethers.utils.computeAddress(privateKey);
// TODO If the private key is invalid, this should return a specific error rather than throwing
exports.setupCredential = ({ privateKey, settlerType }) => async () => ({
    settlerType,
    privateKey: ensureHexPrefix(privateKey),
    address: addressFromPrivate(ensureHexPrefix(privateKey))
});
exports.uniqueId = (cred) => cred.address;
exports.configFromEthereumCredential = ({ address, ...config }) => config;
// TODO Should this be denominated in the ERC-20 itself? (Return array of quantities?)
exports.getBaseBalance = async (settler, credential) => {
    const balanceWei = await settler.ethereumProvider.getBalance(credential.address);
    return crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.baseQuantity(assets_1.ethAsset, balanceWei.toString()));
};
exports.connectUplink = (credential) => (state) => async (config) => {
    const server = config.plugin.btp.serverUri;
    const store = config.plugin.store;
    const { privateKey: ethereumPrivateKey } = credential;
    const settler = state.settlers[credential.settlerType];
    const { ethereumProvider, fetchGasPrice } = settler;
    const assetType = config.assetType || 'ETH';
    const asset = assets_1.getAsset(assetType);
    // If using ERC-20s, fetch token contract address
    // tslint:disable-next-line:no-let
    let tokenAddress;
    if (assetType !== 'ETH') {
        const tokenMetadata = TOKEN_ADDRESSES.find(tokenMetadata => tokenMetadata.ledgerEnv === state.ledgerEnv &&
            tokenMetadata.symbol === assetType);
        if (!tokenMetadata) {
            throw new Error('ERC-20 not supported');
        }
        else {
            tokenAddress = tokenMetadata.tokenAddress;
        }
    }
    const plugin = new ilp_plugin_ethereum_1.default({
        role: 'client',
        server,
        ethereumPrivateKey,
        ethereumProvider,
        getGasPrice: fetchGasPrice,
        tokenAddress
    }, {
        store: new store_1.MemoryStore(store),
        log: log_1.default('ilp-plugin-ethereum')
    });
    const pluginAccount = await plugin._loadAccount('peer');
    const mapToExchangeUnit = operators_1.map(amount => amount.shiftedBy(-asset.exchangeScale));
    const totalSent$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.outgoing, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.outgoing.state), operators_1.map(ilp_plugin_ethereum_1.spentFromChannel), mapToExchangeUnit)
        .subscribe(totalSent$);
    const outgoingCapacity$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.outgoing, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.outgoing.state), operators_1.map(ilp_plugin_ethereum_1.remainingInChannel), mapToExchangeUnit)
        .subscribe(outgoingCapacity$);
    const totalReceived$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.incoming, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.incoming.state), operators_1.map(ilp_plugin_ethereum_1.spentFromChannel), mapToExchangeUnit)
        .subscribe(totalReceived$);
    const incomingCapacity$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.incoming, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.incoming.state), operators_1.map(ilp_plugin_ethereum_1.remainingInChannel), mapToExchangeUnit)
        .subscribe(incomingCapacity$);
    return {
        settlerType: engine_1.SettlementEngineType.Machinomy,
        asset,
        credentialId: exports.uniqueId(credential),
        outgoingCapacity$,
        incomingCapacity$,
        totalReceived$,
        totalSent$,
        pluginAccount,
        plugin
    };
};
exports.deposit = (uplink) => () => async ({ amount, authorize }) => {
    const amountBaseUnits = crypto_rate_utils_1.baseQuantity(crypto_rate_utils_1.exchangeQuantity(uplink.asset, amount))
        .amount;
    await uplink.pluginAccount.fundOutgoingChannel(amountBaseUnits, async (feeWei) => {
        // TODO Check the base layer balance to confirm there's enough $$$ on chain (with fee)!
        await authorize({
            value: amount,
            fee: crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.baseQuantity(assets_1.ethAsset, feeWei))
        });
    });
    // Wait up to 2 minutes for incoming capacity to be created
    await uplink.incomingCapacity$
        .pipe(operators_1.first(amount => amount.isGreaterThan(0)), operators_1.timeout(120000))
        .toPromise();
};
// TODO Move this code into generic "uplink" code?
const withdraw = (uplink) => async (authorize) => {
    /* tslint:disable-next-line:no-let */
    let claimChannel;
    const isAuthorized = new Promise((resolve, reject) => {
        /* tslint:disable-next-line:no-let */
        let claimChannelAuthReady = false;
        const authorizeOnlyOutgoing = async () => !claimChannelAuthReady &&
            authorize({
                value: uplink.outgoingCapacity$.value,
                fee: crypto_rate_utils_1.exchangeQuantity(assets_1.ethAsset, 0)
            }).then(resolve, reject);
        claimChannel = uplink.pluginAccount
            .claimIfProfitable(false, (channel, feeWei) => {
            claimChannelAuthReady = true;
            const internalAuthorize = authorize({
                value: uplink.outgoingCapacity$.value.plus(crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.baseQuantity(uplink.asset, channel.spent)).amount),
                fee: crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.baseQuantity(assets_1.ethAsset, feeWei))
            });
            internalAuthorize.then(resolve, reject);
            return internalAuthorize;
        })
            // If `authorize` was never called to claim the channel,
            // call `authorize` again, but this time only to request the outgoing channel to be closed
            // (this prevents deadlocks if for some reason the incoming channel was already closed)
            .then(authorizeOnlyOutgoing, authorizeOnlyOutgoing);
    });
    // TODO This won't reject if the withdraw fails!
    // Only request the peer to the close if the withdraw is authorized first
    const requestClose = isAuthorized.then(() => uplink.pluginAccount.requestClose());
    // Simultaneously withdraw and request incoming capacity to be removed
    /* tslint:disable-next-line:no-unnecessary-type-assertion */
    await Promise.all([claimChannel, requestClose]);
    // TODO Confirm the incoming capacity has been closed -- or attempt to dispute it?
};
/**
 * ------------------------------------
 * SETTLEMENT MODULE
 * ------------------------------------
 */
exports.Machinomy = {
    setupEngine: exports.setupEngine,
    setupCredential: exports.setupCredential,
    uniqueId: exports.uniqueId,
    connectUplink: exports.connectUplink,
    deposit: exports.deposit,
    withdraw,
    getBaseBalance: exports.getBaseBalance
};
/**
 * Use the `fast` gasPrice per EthGasStation on mainnet
 * Fallback to Web3 eth_gasPrice RPC call if it fails
 */
exports.fetchGasPrice = (ethereumProvider) => () => axios_1.default
    .get('https://ethgasstation.info/json/ethgasAPI.json')
    .then(({ data }) => crypto_rate_utils_1.baseQuantity(crypto_rate_utils_1.accountQuantity(assets_1.ethAsset, data.fast / 10)).amount)
    .catch(async () => bnToBigNumber(await ethereumProvider.getGasPrice()));
const bnToBigNumber = (bn) => new bignumber_js_1.default(bn.toString());
//# sourceMappingURL=machinomy.js.map