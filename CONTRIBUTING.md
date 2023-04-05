[back to README.md](README.md)

# Contributing

## Overview
This package is designed to work with Holochain's Websocket API.


## Development

See [docs/API.md](docs/API.md) for detailed API References


### Environment

- Developed using Node.js `v18.14.2`
- Enter `nix develop` for development environment dependencies.

### Building
No build is required for Node.

Bundling with Webpack is supported for web
```
npx webpack
```

#### Optimizations

- Using `@msgpack/msgpack` instead of `msgpack-lite` because "lite" only reduced the compressed size
  by 3kb (57kb -> 54kb).  It also caused tests to fail and has less support than the official
  library.

### Testing

To run all tests with logging
```
make test-debug
```

- `make test-integration-debug` - **Integration tests only**

> **NOTE:** remove `-debug` to run tests without logging
