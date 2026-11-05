# brace-expansion compat shim

Vendors the **5.0.12** security fix for brace-expansion DoS advisories, with a CJS default-function export so older `minimatch` (3.x via eslint/jest/RN) keeps working.

Upstream `brace-expansion@5` only exports `{ expand }`. Older `minimatch` still does `require('brace-expansion')(pattern)`. This package keeps the patched algorithm and restores a default-function CJS export so a single override clears the advisory without bumping Expo/React Native.
