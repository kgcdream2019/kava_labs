import { AssetQuantity } from '@kava-labs/crypto-rate-utils';
import BigNumber from 'bignumber.js';
import { Option } from 'fp-ts/lib/Option';
import { GrpcClient, InvoiceStream, LndService, PaymentStream } from 'ilp-plugin-lightning';
import { BehaviorSubject } from 'rxjs';
import { State, LedgerEnv } from '..';
import { SettlementEngine, SettlementEngineType } from '../engine';
import { Flavor } from '../types/util';
import { BaseUplink, BaseUplinkConfig, ReadyUplink } from '../uplink';
export interface LndSettlementEngine extends SettlementEngine {
    readonly settlerType: SettlementEngineType.Lnd;
}
/**
 * Confirm a host is semantically valid (e.g. "localhost:8080")
 * and split into component hostname and port
 */
export declare const splitHost: (host: string) => Option<ValidHost>;
export declare type ValidHost = {
    readonly hostname: string;
    readonly port: number;
};
export interface ValidatedLndCredential {
    readonly settlerType: SettlementEngineType.Lnd;
    /** LND node hostname that exposes peering and gRPC server on different ports */
    readonly hostname: string;
    /** Port for gRPC connections */
    readonly grpcPort?: number;
    /** TLS cert as a Base64-encoded string */
    readonly tlsCert: string;
    /** LND macaroon as Base64-encoded string */
    readonly macaroon: string;
}
export declare type LndIdentityPublicKey = Flavor<string, 'LndIdentityPublicKey'>;
export interface ReadyLndCredential {
    readonly settlerType: SettlementEngineType.Lnd;
    /** gRPC client for raw RPC calls */
    readonly grpcClient: GrpcClient;
    /** Wrapped gRPC client in a Lightning RPC service with typed methods and messages */
    readonly service: LndService;
    /** Bidirectional streaming RPC to send outgoing payments and receive attestations */
    readonly paymentStream: PaymentStream;
    /** Streaming RPC of newly added or settled invoices */
    readonly invoiceStream: InvoiceStream;
    /** Lightning secp256k1 public key */
    readonly identityPublicKey: LndIdentityPublicKey;
    /** Streaming updates of balance in channel */
    readonly channelBalance$: BehaviorSubject<BigNumber>;
    /** TODO */
    readonly config: ValidatedLndCredential;
}
export declare const closeCredential: ({ grpcClient }: ReadyLndCredential) => Promise<void>;
export declare const configFromLndCredential: (cred: ReadyLndCredential) => ValidatedLndCredential;
export interface LndUplinkConfig extends BaseUplinkConfig {
    readonly settlerType: SettlementEngineType.Lnd;
    readonly credentialId: LndIdentityPublicKey;
}
export interface LndBaseUplink extends BaseUplink {
    readonly settlerType: SettlementEngineType.Lnd;
    readonly credentialId: LndIdentityPublicKey;
}
export declare type ReadyLndUplink = LndBaseUplink & ReadyUplink;
export declare const getBaseBalance: (credential: ReadyLndCredential) => Promise<AssetQuantity>;
/**
 * ------------------------------------
 * SETTLEMENT MODULE
 * ------------------------------------
 */
export declare const Lnd: {
    setupEngine: (ledgerEnv: LedgerEnv) => Promise<LndSettlementEngine>;
    setupCredential: (opts: ValidatedLndCredential) => () => Promise<ReadyLndCredential>;
    uniqueId: (cred: ReadyLndCredential) => Flavor<string, "LndIdentityPublicKey">;
    closeCredential: ({ grpcClient }: ReadyLndCredential) => Promise<void>;
    connectUplink: (credential: ReadyLndCredential) => (state: State) => (config: BaseUplinkConfig) => Promise<LndBaseUplink>;
    getBaseBalance: (credential: ReadyLndCredential) => Promise<AssetQuantity>;
};
