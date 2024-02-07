
import { decode }			from '@msgpack/msgpack';
import { set_tostringtag }		from './utils.js';


export class CustomError extends Error {
    static [Symbol.toPrimitive] ( hint ) {
	return hint === "number" ? null : `[${this.name} {}]`;
    }

    constructor( ...params ) {
	super( ...params );

	if (Error.captureStackTrace) {
	    Error.captureStackTrace(this, this.constructor);
	}

	this.name			= this.constructor.name;
    }

    [Symbol.toPrimitive] ( hint ) {
	return hint === "number" ? null : this.toString();
    }

    toString () {
	return `[${this.constructor.name}( ${this.message} )]`;
    }

    toJSON ( debug = false ) {
	return {
	    "error":	this.name,
	    "message":	this.message,
	    "stack":	debug === true
		? typeof this.stack === "string" ? this.stack.split("\n") : this.stack
		: undefined,
	};
    }
}
set_tostringtag( CustomError );

export class DeprecationNotice extends CustomError {}
set_tostringtag( DeprecationNotice, "DeprecationNotice" );

export class HolochainClientError extends CustomError {}
set_tostringtag( HolochainClientError, "HolochainClientError" );

// InternalError(String)
export class ConductorError extends HolochainClientError {}
set_tostringtag( ConductorError, "ConductorError" );

// Deserialization(String)
export class DeserializationError extends HolochainClientError {}
set_tostringtag( DeserializationError, "DeserializationError" );

// DnaReadError(String),
export class DnaReadError extends HolochainClientError {}
set_tostringtag( DnaReadError, "DnaReadError" );

// RibosomeError(String),
export class RibosomeError extends HolochainClientError {}
set_tostringtag( RibosomeError, "RibosomeError" );

// RibosomeError( with "Deserialize" in the message ),
export class RibosomeDeserializeError extends HolochainClientError {
    context: any;
    bytes: Uint8Array;
    data: any;

    constructor( message, zome_call_args ) {
	const match			= message.match(/Deserialize\(\[(?<bytes>.*)\]\)/);
	const bytes			= new Uint8Array( match.groups.bytes.split(",") );
	const zome			= zome_call_args.zome_name;
	const method			= zome_call_args.fn_name;

	if ( bytes.length > 32 ) {
	    message			= [
		bytes.slice(0,16).join(", "),
		"...",
		`${bytes.length - 32} more bytes`,
		"...",
		bytes.slice(16,32).join(", "),
	    ].join(" ");
	} else {
	    message			= bytes.join(", ");
	}

	super( `Failed to deserialize input for '${zome}->${method}' [ ${message}] ` );

	this.context			= zome_call_args;
	this.bytes			= bytes;
	this.data			= decode( bytes );
    }
}
set_tostringtag( RibosomeDeserializeError, "RibosomeDeserializeError" );

// ActivateApp(String),
export class ActivateAppError extends HolochainClientError {}
set_tostringtag( ActivateAppError, "ActivateAppError" );

// ZomeCallUnauthorized(String),
export class ZomeCallUnauthorizedError extends HolochainClientError {}
set_tostringtag( ZomeCallUnauthorizedError, "ZomeCallUnauthorizedError" );


const ErrorTypes = {
    DeprecationNotice,
    HolochainClientError,

    ConductorError,
    DeserializationError,
    DnaReadError,
    RibosomeError,
    RibosomeDeserializeError,
    ActivateAppError,
    ZomeCallUnauthorizedError,
};


export default ErrorTypes;
