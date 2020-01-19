"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = __importDefault(require("socket.io-client"));
class CryptoCompareBackend {
    async connect() {
        const symbol = 'BTC';
        this.socket = socket_io_client_1.default('https://streamer.cryptocompare.com/');
        this.socket.emit('SubAdd', {
            subs: [`5~CCCAGG~${symbol}~USD`]
        });
        this.socket.on('m', (message) => {
        });
    }
}
exports.default = CryptoCompareBackend;
//# sourceMappingURL=cryptocompare.js.map