"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ilp_logger_1 = __importDefault(require("ilp-logger"));
const ilp_packet_1 = require("ilp-packet");
const ilp_protocol_ildcp_1 = require("ilp-protocol-ildcp");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const credential_1 = require("./credential");
const engine_1 = require("./engine");
const stream_server_1 = require("./services/stream-server");
const lnd_1 = require("./settlement/lnd");
const machinomy_1 = require("./settlement/machinomy");
const xrp_paychan_1 = require("./settlement/xrp-paychan");
const crypto_1 = require("./utils/crypto");
const middlewares_1 = require("./utils/middlewares");
const packet_1 = require("./utils/packet");
const store_1 = require("./utils/store");
const assets_1 = require("./assets");
const log = ilp_logger_1.default('ilp-sdk:uplink');
/**
 * ------------------------------------
 * GETTING UPLINKS
 * ------------------------------------
 */
// TODO This also MUST check what connector it's connected to! (fix that)
exports.isThatUplink = (uplink) => (someUplink) => someUplink.credentialId === uplink.credentialId &&
    someUplink.settlerType === uplink.settlerType &&
    someUplink.asset.symbol === uplink.asset.symbol;
/**
 * ------------------------------------
 * ADDING & CONNECTING UPLINKS
 * ------------------------------------
 */
/** Get the connector BTP URI without an auth token from the given config */
const getRawServerUri = (config) => config.plugin.btp.serverUri.replace(config.plugin.btp.authToken, '');
exports.createUplink = async (state, readyCredential, assetType) => {
    const connector = assets_1.CONNECTOR_LIST.find(connector => connector.settlerType === readyCredential.settlerType &&
        (!assetType || connector.assetType === assetType) &&
        connector.ledgerEnv === state.ledgerEnv &&
        !!connector.btp);
    if (!connector || !connector.btp) {
        throw new Error('Specified connector not found');
    }
    const authToken = await crypto_1.generateToken();
    const serverUri = connector.btp(authToken);
    const credentialId = credential_1.getCredentialId(readyCredential);
    const config = {
        settlerType: readyCredential.settlerType,
        assetType,
        credentialId,
        stream: {
            serverSecret: (await crypto_1.generateSecret()).toString('hex')
        },
        plugin: {
            btp: {
                serverUri,
                authToken
            },
            store: {}
        }
    };
    const alreadyExists = state.uplinks.some(someUplink => someUplink.credentialId === credentialId &&
        someUplink.settlerType === readyCredential.settlerType &&
        getRawServerUri(someUplink.config) === getRawServerUri(config));
    if (alreadyExists) {
        throw new Error('Cannot create duplicate uplink');
    }
    return exports.connectUplink(state)(readyCredential)(config);
};
exports.connectBaseUplink = (credential) => {
    switch (credential.settlerType) {
        case engine_1.SettlementEngineType.Lnd:
            return lnd_1.Lnd.connectUplink(credential);
        case engine_1.SettlementEngineType.Machinomy:
            return machinomy_1.Machinomy.connectUplink(credential);
        case engine_1.SettlementEngineType.XrpPaychan:
            return xrp_paychan_1.XrpPaychan.connectUplink(credential);
    }
};
exports.connectUplink = (state) => (credential) => async (config) => {
    const uplink = await exports.connectBaseUplink(credential)(state)(config);
    const { plugin, asset, outgoingCapacity$, incomingCapacity$, totalReceived$ } = uplink;
    const maxInFlight = await exports.getNativeMaxInFlight(state, asset);
    const pluginWrapper = new middlewares_1.PluginWrapper({
        plugin,
        maxPacketAmount: maxInFlight,
        assetCode: asset.symbol,
        assetScale: assets_1.getAssetScale(asset),
        log: ilp_logger_1.default(`ilp-sdk:${asset.symbol}:balance`),
        store: new store_1.MemoryStore(config.plugin.store, 'wrapper')
    });
    await plugin.connect();
    const clientAddress = await verifyUpstreamAssetDetails(asset)(plugin);
    const balance$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.combineLatest([
        outgoingCapacity$.pipe(exports.distinctBigNum),
        totalReceived$.pipe(exports.distinctBigNum)
    ])
        .pipe(exports.sumAll)
        .subscribe(balance$);
    // Available to receive (ILP packets) = incomingCapacity - credit already extended
    const availableToReceive$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.combineLatest([
        incomingCapacity$.pipe(exports.distinctBigNum),
        pluginWrapper.receivableBalance$.pipe(exports.distinctBigNum, exports.convertToExchangeUnit(asset))
    ])
        .pipe(exports.subtract)
        .subscribe(availableToReceive$);
    // Available to send (ILP packets) = outgoingCapacity + amount prefunded
    const availableToSend$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.combineLatest([
        outgoingCapacity$.pipe(exports.distinctBigNum),
        pluginWrapper.payableBalance$.pipe(exports.distinctBigNum, exports.convertToExchangeUnit(asset))
    ])
        .pipe(exports.subtract)
        .subscribe(availableToSend$);
    const handlers = {
        streamServerHandler: packet_1.defaultDataHandler,
        streamClientHandler: packet_1.defaultIlpPrepareHandler
    };
    // Setup internal packet handlers and routing
    exports.setupHandlers(pluginWrapper, clientAddress, (data) => handlers.streamServerHandler(data), (prepare) => handlers.streamClientHandler(prepare));
    // Accept incoming payments
    // TODO For now, this won't work, because the original non-wrapper plugin won't auto settle
    const registerServerHandler = (handler) => {
        handlers.streamServerHandler = handler;
    };
    const streamServer = await stream_server_1.startStreamServer(plugin, registerServerHandler, Buffer.from(config.stream.serverSecret, 'hex'));
    return Object.assign(handlers, {
        ...uplink,
        clientAddress,
        streamServer,
        maxInFlight,
        pluginWrapper,
        balance$,
        availableToSend$,
        availableToReceive$,
        config
    });
};
/**
 * Register handlers for incoming packets, routing incoming payments to the STREAM
 * server, and all other packets to the internal switch/trading service.
 *
 * @param plugin ILP plugin to send and receive packets
 * @param clientAddress Resolved address of the root plugin, to differentiate connection tags
 * @param streamServerHandler Handler registered by the STREAM server for anonymous payments
 * @param streamClientHandler Handler for packets sent uplink -> uplink within the api itself
 *
 * EFFECT: registers handlers on the plugin
 */
exports.setupHandlers = (plugin, clientAddress, streamServerHandler, streamClientHandler) => {
    plugin.deregisterDataHandler();
    plugin.registerDataHandler(async (data) => {
        // Apparently plugin-btp will pass data as undefined...
        if (!data)
            throw new Error('no ilp packet included');
        const prepare = ilp_packet_1.deserializeIlpPrepare(data);
        const hasConnectionTag = prepare.destination
            .replace(clientAddress, '')
            .split('.')
            .some(a => !!a);
        return hasConnectionTag
            ? // Connection ID exists in the ILP address, so route to Stream server (e.g. g.kava.39hadn9ma.~n32j7ba)
                streamServerHandler(data)
            : // ILP address is for the root plugin, so route packet to sending connection (e.g. g.kava.39hadn9ma)
                ilp_packet_1.serializeIlpReply(await streamClientHandler(prepare));
    });
};
/** Confirm the upstream peer shares the same asset details and fetch our ILP address */
const verifyUpstreamAssetDetails = (asset) => async (plugin) => {
    // Confirm our peer is compatible with the configuration of this uplink
    const { assetCode, assetScale, clientAddress } = await ilp_protocol_ildcp_1.fetch(data => plugin.sendData(data));
    const incompatiblePeer = assetCode !== asset.symbol || assetScale !== assets_1.getAssetScale(asset);
    if (incompatiblePeer) {
        await plugin.disconnect();
        throw new Error('Upstream connector is using a different asset or configuration');
    }
    return clientAddress;
};
/*
 * ------------------------------------
 * SWITCHING ASSETS
 * (settlements + sending + clearing)
 * ------------------------------------
 */
/**
 * Registers a handler for incoming packets not addressed to a
 * specific Stream connection, such as packets sent from another uplink
 *
 * EFFECT: mutates data handler mapped to the internal plugin
 */
exports.registerPacketHandler = (handler) => (uplink) => {
    uplink.streamClientHandler = handler;
};
/**
 * Removes an existing handler for incoming packets not
 * addressed to a specific Stream connection
 *
 * EFFECT: mutates data handler mapped to the internal plugin
 */
exports.deregisterPacketHandler = exports.registerPacketHandler(packet_1.defaultIlpPrepareHandler);
/** Convert the global max-in-flight amount to the local/native units (base units in plugin) */
exports.getNativeMaxInFlight = async (state, asset) => crypto_rate_utils_1.convert(state.maxInFlightUsd, crypto_rate_utils_1.accountUnit(asset), state.rateBackend).amount.decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
exports.depositToUplink = (uplink) => {
    switch (uplink.settlerType) {
        case engine_1.SettlementEngineType.Lnd:
            return;
        case engine_1.SettlementEngineType.Machinomy:
            return machinomy_1.Machinomy.deposit(uplink);
        case engine_1.SettlementEngineType.XrpPaychan:
            return xrp_paychan_1.XrpPaychan.deposit(uplink);
    }
};
exports.withdrawFromUplink = (uplink) => {
    switch (uplink.settlerType) {
        case engine_1.SettlementEngineType.Lnd:
            return;
        case engine_1.SettlementEngineType.Machinomy:
            return machinomy_1.Machinomy.withdraw(uplink);
        case engine_1.SettlementEngineType.XrpPaychan:
            return xrp_paychan_1.XrpPaychan.withdraw(uplink);
    }
};
/**
 * ------------------------------------
 * REMOVE UPLINK
 * ------------------------------------
 */
/**
 * Gracefully end the session so the uplink can no longer send/receive
 */
exports.closeUplink = async (uplink) => {
    await stream_server_1.stopStreamServer(uplink.streamServer).catch(err => log.error('Error stopping Stream server: ', err));
    return uplink.plugin.disconnect();
};
/**
 * ------------------------------------
 * BASE LAYER BALANCE
 * ------------------------------------
 */
exports.getBaseBalance = (state) => async (uplink) => {
    const credential = credential_1.getCredential(state)(uplink.credentialId);
    switch (credential.settlerType) {
        case engine_1.SettlementEngineType.Lnd:
            return lnd_1.Lnd.getBaseBalance(credential);
        case engine_1.SettlementEngineType.Machinomy:
            const machinomySettler = state.settlers[credential.settlerType];
            return machinomy_1.Machinomy.getBaseBalance(machinomySettler, credential);
        case engine_1.SettlementEngineType.XrpPaychan:
            const xrpSettler = state.settlers[credential.settlerType];
            return xrp_paychan_1.XrpPaychan.getBaseBalance(xrpSettler, credential);
    }
};
/**
 * ------------------------------------
 * RXJS UTILS
 * ------------------------------------
 */
exports.sumAll = operators_1.map((values) => values.reduce((a, b) => a.plus(b)));
exports.subtract = operators_1.map(([a, b]) => a.minus(b));
exports.distinctBigNum = operators_1.distinctUntilChanged((prev, curr) => prev.isEqualTo(curr));
exports.convertToExchangeUnit = (asset) => operators_1.map((value) => crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.accountQuantity(asset, value)).amount);
//# sourceMappingURL=uplink.js.map