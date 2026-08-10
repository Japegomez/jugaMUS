# brace-expansion compat shim

Vendors the **5.0.9** security fix for:

- [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) / CVE-2026-14257 (`maxLength` bound)
- [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) (bounds intermediate arrays / sequences)

Upstream `brace-expansion@5` only exports `{ expand }`. Older `minimatch` (3.x via eslint/jest/RN) still does `require('brace-expansion')(pattern)`. This package keeps the patched algorithm and restores a default-function CJS export so a single override clears the advisory without bumping Expo/React Native.
