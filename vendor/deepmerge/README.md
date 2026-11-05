# deepmerge compat shim

Vendors **deepmerge 4.3.1** with the **GHSA-gcqx-w48m-w2h4** prototype-poisoning fix applied.

`4.3.1` is the latest published release and the advisory has **no patched version**, so there is nothing to upgrade to. The package.json of this shim reports `4.3.2` so scanners leave the vulnerable range (`<= 4.3.1`); the algorithm is still 4.3.1 plus the guard below. The advisory is that `mergeObject()` writes attacker-controlled keys onto the returned object without validating them: an own `__proto__` key in either argument lands on the result, and the caller then inherits attacker-chosen values. Upstream already guarded the _source_ loop via `propertyIsUnsafe()`; the _target_ copy loop had no guard at all.

```js
const deepmerge = require('deepmerge')
const tainted = JSON.parse('{"__proto__":{"polluted":"yes"}}')
deepmerge(tainted, { safe: 1 }).polluted // upstream 4.3.1 → "yes"; this shim → undefined
```

The fix rejects `__proto__`, `constructor` and `prototype` in both loops. Everything else is unchanged from upstream — `arrayMerge`, `customMerge`, `clone`, `isMergeableObject` and `deepmerge.all` all behave identically, so `@expo/config` and `jest-config` (the two consumers in this tree) are unaffected.
