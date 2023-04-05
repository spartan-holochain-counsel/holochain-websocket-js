[![](https://img.shields.io/npm/v/@whi/holochain-websocket/latest?style=flat-square)](http://npmjs.com/package/@whi/holochain-websocket)

# Holochain Client
A Javascript library for communicating with [Holochain](https://holochain.org)'s Websocket API

[![](https://img.shields.io/github/issues-raw/mjbrisebois/js-holochain-websocket?style=flat-square)](https://github.com/mjbrisebois/js-holochain-websocket/issues)
[![](https://img.shields.io/github/issues-closed-raw/mjbrisebois/js-holochain-websocket?style=flat-square)](https://github.com/mjbrisebois/js-holochain-websocket/issues?q=is%3Aissue+is%3Aclosed)
[![](https://img.shields.io/github/issues-pr-raw/mjbrisebois/js-holochain-websocket?style=flat-square)](https://github.com/mjbrisebois/js-holochain-websocket/pulls)


## Overview

### Features

- Request/Response handling
- Detailed error classes


## Install

```bash
npm i @whi/holochain-websocket
```

## Basic Usage

### App Interface

Each example assumes this code is present
```javascript
import { Connection } from '@whi/holochain-websocket';

const admin_interface_port = 45678;

const conn = new Connection( admin_interface_port );
```

#### Example

```javascript
let agent_hash = new HoloHash( await conn.request("generate_agent_pub_key") );
```


### API Reference

See [docs/API.md](docs/API.md)

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
