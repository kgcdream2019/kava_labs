"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const IlpStream = __importStar(require("ilp-protocol-stream"));
const packet_1 = require("../utils/packet");
exports.startStreamServer = async (plugin, registerDataHandler, streamSecret) => {
    const streamServer = await IlpStream.createServer({
        idleTimeout: 360000,
        plugin: exports.wrapStreamPlugin(plugin, registerDataHandler),
        receiveOnly: true,
        serverSecret: streamSecret
    });
    /**
     * TODO Fix this: we love money, but we also don't want randos to exhaust our payment bandwidth! Alternatively:
     * (1) Slowly increment receive max as money is received, but only slowly, so we don't fulfill the full amount
     * (2) Max packet amount to kinda enforce limits? (but only per-packet)
     */
    streamServer.on('connection', (conn) => conn.on('stream', (stream) => stream.setReceiveMax(Infinity)));
    return streamServer;
};
exports.stopStreamServer = (server) => {
    server.removeAllListeners();
    return server.close();
};
exports.wrapStreamPlugin = (plugin, registerDataHandler) => ({
    connect() {
        return plugin.connect();
    },
    disconnect() {
        // Don't let Stream disconnect the plugin
        return Promise.resolve();
    },
    isConnected() {
        return plugin.isConnected();
    },
    sendData(data) {
        return plugin.sendData(data);
    },
    registerDataHandler(handler) {
        registerDataHandler(handler);
    },
    deregisterDataHandler() {
        registerDataHandler(packet_1.defaultDataHandler);
    }
});
//# sourceMappingURL=stream-server.js.map