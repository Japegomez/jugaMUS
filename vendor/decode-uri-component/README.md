# decode-uri-component compat shim

Vendors the **0.5.1** security fix for `decode-uri-component` (GHSA-vcc3-ghjq-m6fr: exponential decoding of malformed percent-encoded input) as a **CommonJS callable**.

Upstream 0.5.x is `"type": "module"` with a single `export default`. Consumers on the Expo/React Native toolchain still do:

```js
const decode = require('decode-uri-component')
decode(value)
```

Against the ESM-only package that `require` yields `{ __esModule: true, default: fn }`, so `query-string@7` throws `decodeComponent is not a function` on every non-empty query string — which is the deep-link parameter path used by `expo-router` and `@react-navigation/core`.

This package keeps the patched linear-time algorithm verbatim and restores the CJS callable shape (`module.exports = fn`, plus `.default` for interop) so a single override clears the advisory without breaking deep linking.
