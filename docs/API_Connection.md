[back to API.md](./API.md)


# API Reference for `Connection` class

## `new Connection( address, options )`
A class for communicating with Holochain Conductor's WebSocket.

- `address` - (*required*) either a *number* or a *string*
  - *number* - the TCP port for WebSocket connection to Conductor API
  - *string* - the TCP address for WebSocket connection to Conductor API
- `options` - optional parameters
- `options.name` - a unique name for this Connection instance
  - defaults to the connection counter
- `options.timeout` - timeout in milliseconds used as the default for requests via this connection
  - defaults to `15000`
- `options.host` - used as the host in the connection address when only a number is given
  - defaults to `127.0.0.1`
- `options.secure` - when `true` the URI scheme will be `wss://`
  - defaults to `false`


### `<Connection>.open( timeout ) -> Promise<undefined>`
Wait for the WebSocket to be open.

- `timeout` - (*optional*) raise `TimeoutError` after # milliseconds
  - defaults to `this.options.timeout`

Returns a Promise that resolves when the WebSocket 'open' event has occurred.

Example
```javascript
let conn = new Connection( 12345 );

await conn.open();
```


### `<Connection>.close( timeout ) -> Promise<code>`
Initiate closing the WebSocket and wait for the WebSocket to be closed.

- `timeout` - (*optional*) raise `TimeoutError` after # milliseconds
  - defaults to `this.options.timeout`

Returns a Promise that resolves with the status code when the WebSocket 'close' event has occurred.

Example
```javascript
let conn = new Connection( 12345 );

await conn.open();

await conn.close();
```


### `<Connection>.send( type, payload, id ) -> undefined`
Send a `Request` type message and a await for the corresponding `Response` message.

- `type` - (*required*) the message type (`Request`, `Response`, `Signal`)
- `payload` - (*optional*) data corresponding to the message type
  - defaults to `undefined`
- `timeout` - (*optional*) raise `TimeoutError` after # milliseconds
  - defaults to `this.options.timeout`

Returns a Promise that resolves with the status code when the WebSocket 'close' event has occurred.

Example
```javascript
let conn = new Connection( 12345 );

await conn.open();

conn.send("Request", {
    "id": 0,
    "type": "register_dna",
    "args": {
        "path": "/path/to/some.dna",
    },
});
```


### `<Connection>.request( method, args, timeout ) -> Promise<code>`
Send a `Request` type message and a await for the corresponding `Response` message.

- `method` - (*required*) the Conductor API method name
- `args` - (*optional*) input corresponding to the given `method`
  - defaults to `null`
- `timeout` - (*optional*) raise `TimeoutError` after # milliseconds
  - defaults to `this.options.timeout`

Returns a Promise that resolves with the response payload when the corresponding `Response` message is received.

Example
```javascript
let conn = new Connection( 12345 );

await conn.open();

let dna_hash = await conn.request("register_dna", {
    "path": "/path/to/some.dna",
});
```
