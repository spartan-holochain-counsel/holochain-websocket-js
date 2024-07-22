[![](https://img.shields.io/npm/v/@spartan-hc/holochain-websocket/latest?style=flat-square)](http://npmjs.com/package/@spartan-hc/holochain-websocket)

# Holochain WebSocket Client
A Javascript library for communicating with [Holochain](https://holochain.org)'s Websocket API

[![](https://img.shields.io/github/issues-raw/spartan-holochain-counsel/holochain-websocket-js?style=flat-square)](https://github.com/spartan-holochain-counsel/holochain-websocket-js/issues)
[![](https://img.shields.io/github/issues-closed-raw/spartan-holochain-counsel/holochain-websocket-js?style=flat-square)](https://github.com/spartan-holochain-counsel/holochain-websocket-js/issues?q=is%3Aissue+is%3Aclosed)
[![](https://img.shields.io/github/issues-pr-raw/spartan-holochain-counsel/holochain-websocket-js?style=flat-square)](https://github.com/spartan-holochain-counsel/holochain-websocket-js/pulls)


## Overview

### Features

- Request/Response handling
- Detailed error classes


## Install

```bash
npm i @spartan-hc/holochain-websocket
```

## Basic Usage

### App Interface

Each example assumes this code is present
```javascript
import { Connection } from '@spartan-hc/holochain-websocket';

const admin_interface_port = 45678;

const conn = new Connection( admin_interface_port );
```

#### Example

```javascript
let agent_hash = await conn.request("generate_agent_pub_key");
```


### API Reference

See [docs/API.md](docs/API.md)

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
