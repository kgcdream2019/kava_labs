"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ws_1 = __importDefault(require("ws"));
const debug_1 = __importDefault(require("debug"));
const log = debug_1.default('crypto-rate-utils:coincap');
const parseJson = (data) => {
    try {
        return JSON.parse(data.toString());
    }
    catch (err) {
        return;
    }
};
const isValidPriceResponse = (o, assets) => typeof o === 'object' &&
    Object.keys(o).every(id => assets.some(asset => asset.id === id)) &&
    Object.values(o).every(rate => typeof rate === 'string' &&
        new bignumber_js_1.default(rate).isPositive() &&
        new bignumber_js_1.default(rate).isFinite());
const POLLING_REFRESH_INTERVAL = 20000;
const MAX_PRICE_AGE = 30000;
exports.connectCoinCap = async () => {
    let assets = [];
    let socket;
    const getAsset = (symbolOrId) => assets.find(asset => asset.id === symbolOrId || asset.symbol === symbolOrId);
    const subscribeTo = (symbol) => assets.map(asset => (Object.assign({}, asset, (asset.symbol === symbol && {
        subscribe: true
    }))));
    const updatePrices = (data) => assets.map(asset => (Object.assign({}, asset, (data[asset.id] && {
        price: new bignumber_js_1.default(data[asset.id]),
        updated: Date.now()
    }))));
    const updateAssets = (data) => data.data.map(({ symbol, id, priceUsd }) => {
        const asset = assets.find(a => a.symbol === symbol);
        return asset && asset.updated > data.timestamp
            ? asset
            : {
                id,
                symbol,
                price: new bignumber_js_1.default(priceUsd),
                updated: Math.min(Date.now(), data.timestamp),
                subscribe: !!asset && asset.subscribe
            };
    });
    const fetchAssets = () => axios_1.default
        .get('https://api.coincap.io/v2/assets')
        .then(({ data }) => {
        assets = updateAssets(data);
    })
        .catch(() => Promise.resolve());
    const resubscribe = () => {
        if (socket) {
            socket.close();
            socket.removeAllListeners();
        }
        const assetIds = assets
            .filter(({ subscribe }) => subscribe)
            .map(({ id }) => id);
        if (assetIds.length === 0) {
            return;
        }
        socket = new ws_1.default(`wss://ws.coincap.io/prices?assets=${assetIds.join(',')}`);
        socket.on('close', () => setTimeout(resubscribe, 5000));
        socket.on('error', () => setTimeout(resubscribe, 5000));
        socket.on('message', message => {
            const data = parseJson(message);
            if (!isValidPriceResponse(data, assets)) {
                throw new Error('failed to update prices: invalid response from CoinCap API');
            }
            assets = updatePrices(data);
        });
    };
    const refresh = setInterval(fetchAssets, POLLING_REFRESH_INTERVAL);
    await fetchAssets();
    return {
        getPrice(symbol) {
            if (symbol === 'USD') {
                return new bignumber_js_1.default(1);
            }
            const asset = getAsset(symbol);
            if (!asset) {
                throw new Error('asset not available via the CoinCap API');
            }
            const { updated, subscribe, price } = asset;
            const outdatedPrice = Date.now() > updated + MAX_PRICE_AGE;
            if (outdatedPrice) {
                throw new Error(`asset price hasn't been updated within the last 30 seconds`);
            }
            try {
                if (!subscribe) {
                    assets = subscribeTo(symbol);
                    resubscribe();
                }
            }
            catch (err) {
                log('Failed to subscribe to CoinCap WebSocket API:', err);
            }
            return price;
        },
        async disconnect() {
            if (socket) {
                socket.removeAllListeners();
                socket.close();
            }
            clearInterval(refresh);
        }
    };
};
//# sourceMappingURL=coincap.js.map