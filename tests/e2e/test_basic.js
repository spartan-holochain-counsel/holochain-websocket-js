import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-e2e", process.env.LOG_LEVEL );

import why				from 'why-is-node-running';

import { expect }			from 'chai';
import puppeteer			from 'puppeteer';

import { Holochain }			from '@spartan-hc/holochain-backdrop';
import { createFileServer }		from '../utils.js';


const HTTP_PORT				= 2222;

let conductor;
let admin_port;

let browser;
let server;
let page;


async function create_page ( url ) {
    const page				= await browser.newPage();

    page.on("console", async ( msg ) => {
	let args			= await Promise.all( msg.args().map( async (jshandle) => await jshandle.jsonValue() ) );
	if ( args.length === 0 )
	    log.error("\x1b[90mPuppeteer console.log( \x1b[31m%s \x1b[90m)\x1b[0m", msg.text() );
	else {
	    log.trace("\x1b[90mPuppeteer console.log( \x1b[37m"+ args.shift() +" \x1b[90m)\x1b[0m", ...args );
	}
    });

    log.info("Go to: %s", url );
    await page.goto( url, { "waitUntil": "networkidle0" } );

    return page;
}


function connection_tests () {
    it("should make request using Connection", async function () {
	let result			= await page.evaluate(async function ( admin_port ) {
	    const conn			= new Connection( admin_port );

	    try {
		return await conn.request("attach_app_interface", {
		    "allowed_origins": "*",
		});
	    } finally {
		await conn.close();
	    }
	}, admin_port );

	log.normal("Attach app interface response: %s", result );
	expect( result.port		).to.be.a("number");
    });

    it("should make request using wrapped WebSocket", async function () {
	let result			= await page.evaluate(async function ( admin_port ) {
	    const socket		= new WebSocket(`ws://localhost:${admin_port}`);
	    socket.binaryType		= "arraybuffer";
	    const conn			= new Connection( socket );

	    try {
		return await conn.request("attach_app_interface", {
		    "allowed_origins": "*",
		});
	    } finally {
		socket.close( 1000, "I'm done with this socket" );
	    }
	}, admin_port );

	log.normal("Attach app interface response: %s", result );
	expect( result.port		).to.be.a("number");
    });
}

describe("E2E: Holochain WebSocket", () => {

    before(async function () {
	this.timeout( 10_000 );

	conductor			= new Holochain({
	    "default_loggers":	process.env.LOG_LEVEL === "trace",
	});

	await conductor.start();

	admin_port			= conductor.adminPorts()[0];

	browser				= await puppeteer.launch();
        server				= createFileServer(
            new URL( "../../", import.meta.url ).pathname,
        );
	server.listen( HTTP_PORT )

	const test_url			= `http://localhost:${HTTP_PORT}/tests/e2e/index.html`;
	page				= await create_page( test_url );
    });

    describe("Connection",	connection_tests );

    after(async () => {
	await conductor.destroy();

	if ( server )
	    server.close();
	if ( page )
	    await page.close();
	if ( browser )
	    await browser.close();

	// setTimeout( () => why(), 1000 );
    });

});
