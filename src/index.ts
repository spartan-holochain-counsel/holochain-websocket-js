
import Emittery                         from 'emittery';
import defaults                         from 'defaults';
import {
    encode,
    decode,
}                                       from '@msgpack/msgpack';
import {
    DnaHash,
    AgentPubKey,
}                                       from '@spartan-hc/holo-hash';
import PromiseTimeoutLib                from '@whi/promise-timeout';

const { PromiseTimeout,
        TimeoutError }                  = PromiseTimeoutLib;

import {
    log,
    set_tostringtag,
    str_eclipse_end,
    str_eclipse_start,
    is_uri,
}                                       from './utils.js';

import {
    HolochainClientError,
    ConductorError,
    DeserializationError,
    DnaReadError,
    RibosomeError,
    RibosomeDeserializeError,
    ActivateAppError,
    ZomeCallUnauthorizedError
}                                       from './errors.js';
import {
    ConnectionOptions,
    PendingRequestInfo,
    PendingRequests,
    ConductorMessage,
    SignalSystemMessage,
    SignalAppMessage,
    SignalPayload,
    Signal,
    ResponseMessage,
    ResponseErrorMessage,
    ResponsePayload,
}                                       from './types.js';



export class Connection extends Emittery {
    static WEBSOCKET_READY_STATES = {
        "0": "CONNECTING",
        "1": "OPEN",
        "2": "CLOSING",
        "3": "CLOSED",
    };
    static DEFAULTS : ConnectionOptions = {
        "timeout": 15_000,
        "host": "localhost",
        "secure": false,
        "ws_options": {
            "origin": "node",
        },
    };
    static #CONNECTION_COUNTER : number = 0;

    #opened:            boolean;
    #closed:            boolean;
    #conn_id:           number;
    #msg_count:         number;
    #pending:           PendingRequests;
    #socket:            any | null;
    #new_socket:        any | boolean;
    #uri:               string;
    #open_f:            Function;
    #open_r:            Function;
    #open:              Promise<null>;
    #close:             Promise<null>;
    #close_f:           Function;

    options: any;
    name: string;

    constructor ( address, options: ConnectionOptions = {} ) {
        if ( address instanceof Connection )
            return address;

        super();

        this.options                    = defaults({
            "name":             Math.random().toString().slice(-6),
            ...options,
        }, Connection.DEFAULTS );

        this.#opened                    = false;
        this.#closed                    = false;

        this.#conn_id                   = Connection.#CONNECTION_COUNTER++;
        this.name                       = this.options.name ? `${this.#conn_id}:` + this.options.name : String( this.#conn_id );

        this.#msg_count                 = 0;
        this.#pending                   = {};

        const uri_scheme                = this.options.secure === true ? "wss://" : "ws://";
        // `address` could be
        //
        //   1. `<port>` using options.host as host
        //   2. `"<host>:<port>"`
        //   3. `"<full address>"`
        //
        // Where the scheme will be prepended for 1 and 2 as "ws://"
        // - or "wss://" if options.secure is true)
        //
        this.#socket                    = null;
        this.#new_socket                = false;

        if ( address instanceof WebSocket ) {
            this.#socket                = address;
            this.#uri                   = this.#socket.url;

            // check websocket binarytype
            if ( this.#socket.binaryType !== "arraybuffer" )
                throw new TypeError(`The given WebSocket connection must have 'binaryType' set to 'arraybuffer'; not '${this.#socket.binaryType}'`);
        }
        else {
            if ( typeof address === "number" ) {
                if ( ! (address > 0 && address < 65_536) )
                    throw new SyntaxError(`Invalid port: ${address}; must be between 1..65536`);

                this.#uri                       = uri_scheme + `${this.options.host}:${address}`;
            }
            else if ( typeof address === "string" ) {
                if ( is_uri( address ) )
                    this.#uri           = address;
                else
                    this.#uri           = uri_scheme + address;
            }
            else
                throw new TypeError(`Invalid address input: ${typeof address}; expected number or string`);

            new URL( this.#uri ); // Check if valid URI

            try {
                log.debug && this.#log("Opening connection to: %s", this.#uri );

                this.#new_socket        = true;
                // @ts-ignore
                this.#socket            = new WebSocket( this.#uri, [], this.options.ws_options );
                this.#socket.binaryType = "arraybuffer";

                log.debug && this.#log("Initialized new Connection()");
            } catch (err) {
                console.error(err);
                this.#open_r(err);
            }
        }

        this.#open                      = new Promise( (f,r) => {
            this.#open_f                = f;
            this.#open_r                = r;
        });

        this.#close                     = new Promise( f => {
            this.#close_f               = f;
        });

        const open_error                = new Error("");

        this.#socket.onerror            = ( event ) => {
            if ( this.#opened === false ) {
                open_error.message      = `Failed to open WebSocket(${event.target.url}): ${event.message}`;
                this.#open_r( open_error );
            }
            else {
                console.error(`${this} socket error:`, event.error );
                // this.emit("error", event.error );
            }
        };

        this.#socket.onopen             = () => {
            log.debug && this.#log("Received 'open' event");
            this.#opened                = true;
            this.#open_f();
        };
        if ( this.#socket.readyState === this.#socket.OPEN )
            this.#open_f();

        this.#socket.onclose            = ( event ) => {
            log.debug && this.#log("Received 'close' event (code: %s): %s", event.code, event.reason );
            this.#closed                = true;
            this.#close_f( event.code );
            this.flush();
        };

        this.#socket.onmessage          = ( event ) => {
            this.#message_handler( event.data );
        };
    }

    get id () : number {
        return this.#conn_id;
    }

    get uri () : string {
        return this.#uri;
    }

    get readyState () : number {
        return this.#socket.readyState;
    }

    get state () : string {
        return Connection.WEBSOCKET_READY_STATES[ this.readyState ];
    }

    get sharedSocket () : boolean {
        return this.#new_socket === false;
    }

    get messageCount () : number {
        return this.#msg_count;
    }

    get pendingCount () : number {
        return Object.keys( this.#pending ).length;
    }

    get opened() {
        return this.#opened;
    }

    get closed() {
        return this.#closed;
    }

    open ( timeout?: number ) : Promise<void> {
        if ( timeout === undefined )
            timeout                     = this.options.timeout;

        return new PromiseTimeout( this.#open.then.bind(this.#open), timeout, "open WebSocket" );
    }

    close ( timeout?: number ) : Promise<void> {
        if ( this.#new_socket === false )
            throw new Error(`The WebSocket was not created by this Connection instance`);

        if ( timeout === undefined )
            timeout                     = this.options.timeout;

        log.debug && this.#log("Closing connection on puprose");
        this.#socket.close( 1000, "I'm done with this socket" );

        return new PromiseTimeout( this.#close.then.bind(this.#close), timeout, "close WebSocket" );
    }

    flush () {
        const pending_count             = this.pendingCount;

        for ( let id in this.#pending ) {
            this.#pending[id].reject(
                new Error(`Connection has been flushed`)
            );
        }

        return pending_count;
    }

    async send (
        send_type               : string,
        payload                 : any,
        id                     ?: number,
    ) : Promise<void> {
        if ( this.#socket === null )
            throw new Error(`Cannot send message until socket is open: ${this}`);

        const msg                       = {
            "id":       undefined,
            "type":     send_type,
            "data":     encode( payload ),
        };

        if ( id !== undefined )
            msg.id                      = id;

        const packed_msg                = encode( msg );

        log.debug && this.#log("Ready state '%s'", this.#socket.readyState );
        if ( this.#socket.readyState === this.#socket.CONNECTING )
            await this.open();

        if ( [ this.#socket.CLOSED, this.#socket.CLOSING ].includes( this.#socket.readyState ) )
            throw new Error(`Socket is already closed`);

        this.#socket.send( packed_msg );
    }

    async authenticate (
        token                   : Uint8Array,
    ) : Promise<void> {
        if ( [null, undefined].includes( token ) )
            throw new Error(`Missing authentication token`);

        if ( !(token instanceof Uint8Array) )
            throw new TypeError(`Authentication token must be a Uint8Array; not type '${(token as any)?.constructor?.name || typeof token}'`);

        await this.open();

        // Authenticate input requires the token to be an Array
        const token_input               = [ ...token ];

        await this.send( "authenticate", {
            "token": token_input,
        });
    }

    request (
        method                  : string,
        args                    : any = null,
        timeout                ?: number,
    ) : Promise<any> {
        if ( timeout === undefined )
            timeout                     = this.options.timeout;

        const payload                   = {
            "type": { [method]: null },
            "data": args,
        };

        const stack                     = (new Error("")).stack.split("\n").slice(1).join("\n");

        return new PromiseTimeout( (f,r) => {
            const id                    = this.#msg_count++;

            this.#pending[id]           = {
                method,
                args,
                "resolve": f,
                "reject": r,
                stack,
            };

            this.send( "request", payload, id ).catch(r);
        }, timeout, `get response for request '${method}'` );
    }

    #log (
        msg: string,
        ...args: Array<any>
    ) : void {
        log(`${this} => ${msg}`, ...args );
    }

    async #message_handler ( packed_msg: Uint8Array ) : Promise<void> {
        try {
            log.debug && this.#log("WebSocket message: %s bytes", packed_msg.byteLength );
            let msg : ConductorMessage  = decode( packed_msg ) as any;

            log.debug && this.#log("Message type '%s': { %s }", msg.type, Object.keys(msg).join(", ") );

            if ( msg.type === "response" )
                await this.#handle_response( msg );
            else if ( msg.type === "signal" )
                await this.#handle_signal( msg );
            else
                console.error("Unknown message type:", msg.type, msg );
        } catch (err) {
            console.error(err);
        }
    }

    async #handle_signal ( message ) : Promise<void> {
        const payload : SignalPayload   = decode( message.data ) as any;
        // console.log( payload );

        if ( "System" in payload ) {
            // Do nothing...
            return;
        }
        else if ( !("App" in payload) )
            throw new TypeError(`Unknown signal type [${Object.keys(payload).join(", ")}]`);

        // console.log( payload );
        const app_signal                = payload.App;

        const cell_id                   = app_signal.cell_id;
        const zome_name                 = app_signal.zome_name;
        const signal : Signal           = decode( app_signal.signal ) as any;
        // console.log( signal );

        const sig_type                  = signal.type;
        delete signal.type;

        // console.log("Emit 'signal:%s'", sig_type );
        this.emit("signal", {
            "agent":            new AgentPubKey( cell_id[1] ),
            "dna":              new DnaHash( cell_id[0] ),
            "zome":             zome_name,
            "message":          app_signal.signal,
            "signal":{
                "type":         sig_type,
                "data":         signal,
            },
        });
    }

    async #handle_response ( response ) : Promise<void> {
        const id                        = response.id;
        const request                   = this.#pending[id];

        delete this.#pending[id];

        if ( [ null, undefined ].includes( response.data ) )
            throw new Error(`Response cancelled by Conductor`);

        if ( request.resolve === undefined )
            throw new Error(`There is no pending request for response ID: ${id}`);

        if ( typeof request.resolve !== "function" )
            throw new Error(`Broken state: pending request value is not a function: ${typeof request.resolve}`);

        const payload : ResponsePayload = decode( response.data ) as any;
        log.debug && this.#log("Response payload type '%s': { %s }", payload.type, Object.keys(payload).join(", ") );

        if ( payload.type === "error" ) {
            const error_type            = payload.data.type;
            const message               = payload.data.data;
            log.debug && this.#log("Response error type '%s': { %s }", error_type, Object.keys(payload.data).join(", ") );

            let err                     = new Error( message );
            if ( error_type === "internal_error" ) {
                err                     = new ConductorError( message );
            }
            else if ( error_type === "deserialization" ) {
                err                     = new DeserializationError( message );
            }
            else if ( error_type === "dna_read_error" ) {
                err                     = new DnaReadError( message );
            }
            else if ( error_type === "ribosome_error" ) {
                if ( message.includes("Wasm runtime error while working with Ribosome") && message.includes("error: Deserialize") )
                    err                 = new RibosomeDeserializeError( message, request.args );
                else
                    err                 = new RibosomeError( message );
            }
            else if ( error_type === "activate_app" ) {
                err                     = new ActivateAppError( message );
            }
            else if ( error_type === "zome_call_unauthorized" ) {
                err                     = new ZomeCallUnauthorizedError( message );
            }
            else {
                // Unknown
                console.error("Unknown error type: %s", error_type );
            }

            err.stack                   = err.stack.split("\n")[0] + "\n" + request.stack;

            log.debug && this.#log("Calling reject for request %s: %s", id, String(err) );
            return request.reject( err );
        }
        else {
            return request.resolve( payload.data );
        }
    }

    toJSON () : string {
        return this.toString();
    }

    toString () : string {
        let ctx                         = this.#socket ? `[${ Connection.WEBSOCKET_READY_STATES[this.#socket.readyState] }]` : "[N/A]";
        return `${ str_eclipse_end( this.name, 8 ) } ${ str_eclipse_start( this.#uri, 25 ) } ${ ctx.padStart(12) }`;
    }
}
set_tostringtag( Connection );


export {
    PromiseTimeout,
    TimeoutError,

    HolochainClientError,
    ConductorError,
    DeserializationError,
    DnaReadError,
    RibosomeError,
    RibosomeDeserializeError,
    ActivateAppError,
    ZomeCallUnauthorizedError,
};

export * from './types.js';

export default {
    Connection,

    PromiseTimeout,
    TimeoutError,

    HolochainClientError,
    ConductorError,
    DeserializationError,
    DnaReadError,
    RibosomeError,
    RibosomeDeserializeError,
    ActivateAppError,
    ZomeCallUnauthorizedError,
};
