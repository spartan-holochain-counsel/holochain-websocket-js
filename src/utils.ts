
export function set_tostringtag (
    cls: new (...args) => any,
    name?: string,
) : void {
    Object.defineProperty( cls, "name", {
	value: name || cls.name,
    });
    Object.defineProperty( cls.prototype, Symbol.toStringTag, {
	value: name || cls.name,
	enumerable: false,
    });
}


export function str_eclipse_end ( str: string, length: number ) : string {
    if ( length <= 0 )
	throw new Error(`Invalid length value '${length}' for str_eclipse_end`);

    return str.length > length
	? str.slice( 0, length - 1 ) + "\u2026"
	: str.padEnd( length );
}


export function str_eclipse_start ( str: string, length: number ) : string {
    if ( length <= 0 )
	throw new Error(`Invalid length value '${length}' for str_eclipse_start`);

    return str.length > length
	? "\u2026" + str.slice( -( length-1 ) )
	: str.padStart( length );
}


export function log ( msg: string, ...args: Array<any> ) : void {
    let datetime			= (new Date()).toISOString();
    console.log(`${datetime} [ src/index. ]  INFO: ${msg}`, ...args );
}
log.debug				= false;


export function is_uri ( address: string ) : boolean {
    return /^[A-Za-z0-9.\-+]+\:\/\//.test( address );
}
