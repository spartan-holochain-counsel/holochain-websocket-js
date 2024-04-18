import { Logger }			from '@whi/weblogger';
const log				= new Logger("test-basic", process.env.LOG_LEVEL );

import why				from 'why-is-node-running';

import path				from 'path';
import { expect }			from 'chai';
import nacl				from 'tweetnacl';

import { encode, decode }		from '@msgpack/msgpack';
import { hashZomeCall }			from '@holochain/serialization';
import { HoloHash,
	 AgentPubKey }			from '@spartan-hc/holo-hash';

import { Holochain }			from '@spartan-hc/holochain-backdrop';

import {
    expect_reject,
    linearSuite,
}					from '../utils.js';
import { Connection,
	 DeserializationError,
	 TimeoutError }			from '../../lib/node.js';


const TEST_HAPP_PATH			= new URL( "../packs/storage.happ", import.meta.url ).pathname;
const TEST_APP_ID			= "test-app";

let socket, conn;
let dna_hash;
let agent_hash;
let app_port;


describe("Integration: Wrap Existing WebSocket", () => {
    let conductor;

    before(async () => {
	conductor			= new Holochain();
	await conductor.start();

	const admin_port		= conductor.adminPorts()[0];

	socket				= new WebSocket(`ws://localhost:${admin_port}`, [], {
	    "origin": "node",
	});
	socket.binaryType		= "arraybuffer";

	conn				= new Connection( socket );
    });

    linearSuite("Connection",	connection_tests );
    linearSuite("Errors",	errors_tests );

    after(async () => {
	if ( socket )
	    socket.close( 1000, "I'm done with this socket" );

	await conductor.destroy();
    });

});


function connection_tests () {
    it("should call admin API method", async function () {
	this.timeout( 30_000 );

	log.trace("Sending 'attach app interface'");
	let resp			= await conn.request("attach_app_interface", {
	    "allowed_origins": "*",
	});
	log.info("Awaited 'app interface': %s", resp );

	app_port			= resp.port;
    });

    it("should install app and activate", async function () {
	this.timeout( 10_000 );

	agent_hash			= new HoloHash( await conn.request("generate_agent_pub_key") );
	log.normal("Agent response: %s", agent_hash );

	let installation		= await conn.request("install_app", {
	    "installed_app_id": TEST_APP_ID,
	    "agent_key": agent_hash,
	    "membrane_proofs": {},
	    "path": TEST_HAPP_PATH,
	});
	log.normal("Installed app '%s'", installation.installed_app_id );

	for ( let role_name in installation.cell_info ) {
	    let cells			= installation.cell_info[ role_name ];
	    log.trace("  - %s [ %s::%s ] (provisioned: %s) - %s clones", () => [
		role_name,
		new HoloHash( cells[0].provisioned.cell_id[0] ),
		new HoloHash( cells[0].provisioned.cell_id[1] ),
		!!cells[0].provisioned, cells.length - 1
	    ]);
	}

	dna_hash			= installation.cell_info.storage[0].provisioned.cell_id[0];

	await conn.request("enable_app", {
	    "installed_app_id": TEST_APP_ID,
	});
	log.normal("Enable app");
    });

    it("should grant unrestricted zome calling for all functions", async function () {
	const cap_grant			= await conn.request("grant_zome_call_capability", {
	    "cell_id": [ dna_hash, agent_hash ],
	    "cap_grant": {
		"tag": "unrestricted-zome-calling",
		"functions": {
		    "All": null,
		},
		"access": {
		    "Unrestricted": null,
		},
	    },
	});
    });

    it("should call zome function via app interface", async function () {
	this.skip(); // TODO: update happ dependency so this test can pass
	this.timeout( 5_000 );

	const key_pair			= nacl.sign.keyPair();
	const zome_call_request		= {
	    "cap":		null,
	    "cell_id":		[ dna_hash, agent_hash ],
	    "zome_name":	"mere_memory", // if the zome doesn't exist it never responds
	    "fn_name":		"save_bytes", // if the function doesn't exist it is RibosomeError
	    "payload":		encode( Buffer.from("Super important bytes") ),
	    "provenance":	new AgentPubKey( key_pair.publicKey ),
	    "nonce":		nacl.randomBytes( 32 ),
	    "expires_at":	(Date.now() + (5 * 60 * 1_000)) * 1_000,
	};
	const zome_call_hash		= await hashZomeCall( zome_call_request );

	zome_call_request.signature	= nacl.sign( zome_call_hash, key_pair.secretKey )
	    .subarray( 0, nacl.sign.signatureLength );

	const app			= new Connection( app_port );
	await app.open();

	try {
	    let resp			= await app.request("call_zome", zome_call_request );
	    let essence			= decode( resp );
	    let result			= new HoloHash( essence.payload );
	    log.normal("Save bytes response: %s", result );
	} finally {
	    await app.close();
	}
    });
}

function errors_tests () {
    it("should fail to close WebSocket owned outside Connection instance", async function () {
	await expect_reject( async () => {
	    await conn.close();
	}, Error, "not created by this Connection instance" );
    });

    it("should call invalid API method", async function () {
	this.skip();
	this.timeout( 10_000 );

	await expect_reject( async () => {
	    await conn.request("invalid_api_endpoint");
	}, DeserializationError, "expected one of" );
    });
}
