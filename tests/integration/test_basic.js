import { Logger }                       from '@whi/weblogger';
const log                               = new Logger("test-basic", process.env.LOG_LEVEL );

import why                              from 'why-is-node-running';

import path                             from 'path';
import { expect }                       from 'chai';
import nacl                             from 'tweetnacl';

import { encode, decode }               from '@msgpack/msgpack';
import { hashZomeCall }                 from '@holochain/serialization';
import { HoloHash,
         AgentPubKey }                  from '@spartan-hc/holo-hash';

import { Holochain }                    from '@spartan-hc/holochain-backdrop';

import {
    expect_reject,
    linearSuite,
}                                       from '../utils.js';
import HolochainWebsocket               from '../../lib/node.js';
import { Connection }                   from '../../lib/node.js';


const TEST_HAPP_PATH                    = new URL( "../packs/storage.happ", import.meta.url ).pathname;
const TEST_APP_ID                       = "test-app";

let conn, admin_port;
let dna_hash;
let agent_hash;
let holochain;
let app_port, auth;


describe("Integration: Connection", () => {

    before(async () => {
        holochain                       = new Holochain();
        await holochain.start();

        admin_port                      = holochain.adminPorts()[0];
        conn                            = new Connection( admin_port, {
            "ws_options": {
                "maxPayload": 100e6, // 100mb
            },
        });

        await conn.open();
        log.trace("%s => Connection is open", conn.toString() );
    });

    linearSuite("Connection",   connection_tests );
    linearSuite("Errors",       errors_tests );

    after(async () => {
        await conn.close();
        log.trace("%s => Connection is closed", conn.toString() );
        // setTimeout( () => why(), 1000 );
    });

    after(async () => {
        await holochain.destroy();
    });

});


function connection_tests () {
    it("should check inspection methods", async function () {
        expect( conn.id                 ).to.equal( 0 );
        expect( conn.uri                ).to.equal( `ws://localhost:${admin_port}` );
        expect( conn.readyState         ).to.equal( 1 );
        expect( conn.state              ).to.equal( "OPEN" );
        expect( conn.sharedSocket       ).to.be.false;
        expect( conn.messageCount       ).to.equal( 0 );
        expect( conn.pendingCount       ).to.equal( 0 );
        expect( conn.options.ws_options ).to.deep.equal({
            "origin": "node",
            "maxPayload": 100e6,
        });
    });

    it("should call admin API method", async function () {
        log.trace("Sending 'attach app interface'");
        let resp                        = await conn.request("attach_app_interface", {
            "allowed_origins": "*",
        });
        log.info("Awaited 'app interface': %s", resp );

        app_port                        = resp.port;
    });

    it("should install app and activate", async function () {
        this.timeout( 10_000 );

        agent_hash                      = new HoloHash( await conn.request("generate_agent_pub_key") );
        log.normal("Agent response: %s", agent_hash );

        let installation                = await conn.request("install_app", {
            "installed_app_id": TEST_APP_ID,
            "agent_key": agent_hash,
            "membrane_proofs": {},
            "path": TEST_HAPP_PATH,
        });
        log.normal("Installed app '%s'", installation.installed_app_id );

        for ( let role_name in installation.cell_info ) {
            let cells                   = installation.cell_info[ role_name ];
            log.trace("  - %s [ %s::%s ] (provisioned: %s) - %s clones", () => [
                role_name,
                new HoloHash( cells[0].provisioned.cell_id[0] ),
                new HoloHash( cells[0].provisioned.cell_id[1] ),
                !!cells[0].provisioned, cells.length - 1
            ]);
        }

        dna_hash                        = installation.cell_info.storage[0].provisioned.cell_id[0];

        await conn.request("enable_app", {
            "installed_app_id": TEST_APP_ID,
        });
        log.normal("Enable app");

        auth                            = await holochain.admin.issueAppAuthenticationToken({
            "installed_app_id":         TEST_APP_ID,
            "single_use":               false,
        });
    });

    it("should grant unrestricted zome calling for all functions", async function () {
        const cap_grant                 = await conn.request("grant_zome_call_capability", {
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
        this.timeout( 5_000 );

        const key_pair                  = nacl.sign.keyPair();
        const zome_call_request         = {
            "cap":              null,
            "cell_id":          [ dna_hash, agent_hash ],
            "zome_name":        "mere_memory_csr",
            "fn_name":          "make_hash_path",
            "payload":          encode( "hello.world" ),
            "provenance":       new AgentPubKey( key_pair.publicKey ),
            "nonce":            nacl.randomBytes( 32 ),
            "expires_at":       (Date.now() + (5 * 60 * 1_000)) * 1_000,
        };
        const zome_call_hash            = await hashZomeCall( zome_call_request );

        zome_call_request.signature     = nacl.sign( zome_call_hash, key_pair.secretKey )
            .subarray( 0, nacl.sign.signatureLength );

        const app_conn                  = new Connection( app_port );
        await app_conn.authenticate( auth.token );

        try {
            let resp                    = await app_conn.request("call_zome", zome_call_request );
            let essence                 = decode( resp );
            log.normal("Make hash Path response: %s", essence.payload );
        } finally {
            await app_conn.close();
        }
    });
}

function errors_tests () {
    it("should fail to connect because invalid connection input", async function () {
        await expect_reject( async () => {
            let conn                    = new Connection( 83283728 );
            try {
                await conn.open();
            } finally {
                await conn.close();
            }
        }, SyntaxError, "Invalid port" );

        await expect_reject( async () => {
            let conn                    = new Connection( "localhost:37287" );
            try {
                await conn.open();
            } finally {
                await conn.close();
            }
        }, Error, "Failed to open WebSocket" );

        await expect_reject( async () => {
            let conn                    = new Connection( "example.com:37287", {
                "timeout": 100,
            });
            try {
                await conn.open();
            } finally {
                await conn.close();
            }
        }, HolochainWebsocket.TimeoutError );
    });

    it("should call invalid API method", async function () {
        this.timeout( 30_000 );

        await expect_reject( async () => {
            await conn.request("invalid_api_endpoint");
        }, "Connection has been flushed" );
        // }, HolochainWebsocket.DeserializationError, "expected one of" );
    });

    it("should fail to call zome function after closed", async function () {
        const conn                      = new Connection( app_port );
        await conn.authenticate( auth.token );
        await conn.close();

        await expect_reject( async () => {
            await conn.request("attach_app_interface");
        }, "Socket is already closed" );
    });

    // Connection: undefined payload for type Request
}
