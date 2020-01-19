import { SocketIOClient } from 'socket.io-client';
export default class CryptoCompareBackend {
    protected socket?: SocketIOClient.Socket;
    connect(): Promise<void>;
}
