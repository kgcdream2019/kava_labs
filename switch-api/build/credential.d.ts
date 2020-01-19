import { SettlementEngineType } from './engine';
import { ValidatedLndCredential, ReadyLndCredential } from './settlement/lnd';
import { UnvalidatedXrpSecret, ValidatedXrpSecret } from './settlement/xrp-paychan';
import { State } from '.';
import { ReadyEthereumCredential, ValidatedEthereumPrivateKey } from './settlement/machinomy';
export declare type CredentialConfigs = (ValidatedLndCredential | ValidatedEthereumPrivateKey | UnvalidatedXrpSecret) & {
    readonly settlerType: SettlementEngineType;
};
export declare type ReadyCredentials = (ReadyLndCredential | ReadyEthereumCredential | ValidatedXrpSecret) & {
    readonly settlerType: SettlementEngineType;
};
export declare const setupCredential: (credential: CredentialConfigs) => (() => Promise<ReadyEthereumCredential>) | ((state: State) => Promise<import("./types/util").Flavor<{
    readonly settlerType: SettlementEngineType.XrpPaychan;
    readonly secret: string;
    readonly address: string;
}, "ValidatedXrpSecret">>) | (() => Promise<ReadyLndCredential>);
export declare const getCredential: (state: State) => <TReadyCredential extends ReadyCredentials>(credentialId: string) => TReadyCredential | undefined;
export declare const getOrCreateCredential: (state: State) => (credentialConfig: CredentialConfigs) => Promise<ReadyCredentials>;
export declare const getCredentialId: (credential: ReadyCredentials) => string;
export declare const closeCredential: (credential: ReadyCredentials) => Promise<void>;
export declare const isThatCredentialId: <TReadyCredential extends ReadyCredentials>(credentialId: string, settlerType: SettlementEngineType) => (someCredential: ReadyCredentials) => someCredential is TReadyCredential;
export declare const isThatCredential: <TReadyCredential extends ReadyCredentials>(credential: ReadyCredentials) => (someCredential: ReadyCredentials) => someCredential is TReadyCredential;
export declare const credentialToConfig: (credential: ReadyCredentials) => CredentialConfigs;
