
export function set_tostringtag ( cls, name? ) {
    Object.defineProperty( cls, "name", {
	value: name || cls.name,
    });
    Object.defineProperty( cls.prototype, Symbol.toStringTag, {
	value: name || cls.name,
	enumerable: false,
    });
}


export function str_eclipse_end ( str, length ) {
    if ( length <= 0 )
	throw new Error(`Invalid length value '${length}' for str_eclipse_end`);

    return str.length > length
	? str.slice( 0, length - 1 ) + "\u2026"
	: str.padEnd( length );
}

export function str_eclipse_start ( str, length ) {
    if ( length <= 0 )
	throw new Error(`Invalid length value '${length}' for str_eclipse_start`);

    return str.length > length
	? "\u2026" + str.slice( -( length-1 ) )
	: str.padStart( length );
}

export function log ( msg, ...args ) {
    let datetime			= (new Date()).toISOString();
    console.log(`${datetime} [ src/index. ]  INFO: ${msg}`, ...args );
}
log.debug				= false;
