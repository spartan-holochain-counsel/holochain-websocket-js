
import {
    ClientOptions,
}                                       from 'ws';
import {
    DnaHash,
    AgentPubKey,
}                                       from '@spartan-hc/holo-hash';


export type ConnectionOptions = {
    name?:              string,
    timeout?:           number,
    host?:              string,
    secure?:            boolean,
    ws_options?:        ClientOptions,
};

export type PendingRequestInfo = {
    method:     string,
    args:       any,
    resolve:    Function,
    reject:     Function,
    stack:      string,
};

export type PendingRequests = {
    [key: string]: PendingRequestInfo,
};

export type ConductorMessage = {
    type: string,
    data: Uint8Array,
};

export type SignalSystemMessage = {
    System: any,
};
export type SignalAppMessage = {
    App: {
        cell_id: [ DnaHash, AgentPubKey ],
        zome_name: string,
        signal: Uint8Array,
    },
};
export type SignalPayload = SignalSystemMessage | SignalAppMessage;
export type Signal = {
    type: string,
    data: Uint8Array,
};

export type ResponseMessage = {
    type: string,
    data: any,
};
export type ResponseErrorMessage = {
    type: string,
    data: {
        type: string,
        data: any,
    },
};
export type ResponsePayload = ResponseMessage | ResponseErrorMessage;
