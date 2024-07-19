import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-utils", process.env.LOG_LEVEL );

import fs                               from 'node:fs/promises';
import path                             from 'node:path';
import url                              from 'node:url';
import http                             from 'node:http';

import { expect }			from 'chai';


export async function expect_reject ( cb, error, message ) {
    let failed				= false;
    try {
	await cb();
    } catch (err) {
	failed				= true;
	expect( () => { throw err }	).to.throw( error, message );
    }
    expect( failed			).to.be.true;
}


export function linearSuite ( name, setup_fn, args_fn ) {
    describe( name, function () {
	beforeEach(function () {
	    let parent_suite		= this.currentTest.parent;
	    if ( parent_suite.tests.some(test => test.state === "failed") )
		this.skip();
	    if ( parent_suite.parent?.tests.some(test => test.state === "failed") )
		this.skip();
	});
	setup_fn.call( this, args_fn );
    });
}


export function createFileServer( directory ) {
    if ( !path.isAbsolute( directory ) )
        throw new Error('The directory path must be absolute');

    const mimeTypes                     = {
        ".html":        "text/html",
        ".js":          "application/javascript",
    };

    const server = http.createServer( async (req, resp) => {
        function end ( data = "", code = 200, mime_type = "application/octet-stream" ) {
            resp.statusCode             = code;
            resp.setHeader("Content-Type", mime_type );
            resp.end( data );
        }

        try {
            const req_path              = decodeURIComponent( url.parse( req.url ).pathname );
            const file_path             = path.resolve( path.join( directory, req_path ) );
            log.info("HTTP server request for resouce: %s", file_path );

            if ( req_path.endsWith("favicon.ico") )
                return end();

            // Ensure the requested path is within the server root.
            if ( !file_path.startsWith( directory ) )
                return end( "Access denied", 403 );

            try {
                const data              = await fs.readFile( file_path );
                const ext               = path.extname( file_path ).toLowerCase();

                end( data, 200, mimeTypes[ ext ] );
            } catch (err) {
                end( `File not found: ${req.url}`, 404 );
            }
        } catch (error) {
            console.error( error );
            end( `Internal server error: ${error.message}`, 500 );
        }
    });

    return server;
}


export default {
    expect_reject,
    linearSuite,
    createFileServer,
};
