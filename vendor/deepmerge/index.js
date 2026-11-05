'use strict';

// deepmerge 4.3.1 with the GHSA-gcqx-w48m-w2h4 prototype-poisoning fix.
//
// Upstream 4.3.1 is the latest published release and has no patched version, so
// the override points at this shim. The advisory is that `mergeObject()` writes
// attacker-controlled keys onto the returned object without validating them:
// an own `__proto__` key in either argument lands on the result and the caller
// then inherits attacker-chosen values. `propertyIsUnsafe()` only guarded the
// source loop; the target copy loop had no guard at all.
//
// The fix below blocks the three keys that can rewrite a prototype chain
// (`__proto__`, `constructor`, `prototype`) in both loops, and applies the
// existing unsafe-property check to the target copy loop as well. Everything
// else — including custom `arrayMerge`, `customMerge` and `clone` options — is
// unchanged from upstream, so consumers that pass custom options keep working.

function isMergeableObject(value) {
	return isNonNullObject(value) && !isSpecial(value);
}

function isNonNullObject(value) {
	return !!value && typeof value === 'object';
}

function isSpecial(value) {
	var stringValue = Object.prototype.toString.call(value);

	return (
		stringValue === '[object RegExp]' ||
		stringValue === '[object Date]' ||
		isReactElement(value)
	);
}

// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

function isReactElement(value) {
	return value.$$typeof === REACT_ELEMENT_TYPE;
}

// Keys that can reach or replace a prototype when assigned onto a plain object.
// A literal `{ __proto__: ... }` would set the prototype instead of creating an
// own key, so the membership list is built explicitly.
function isUnsafeKey(key) {
	return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function emptyTarget(val) {
	return Array.isArray(val) ? [] : {};
}

function cloneUnlessOtherwiseSpecified(value, options) {
	return options.clone !== false && options.isMergeableObject(value)
		? deepmerge(emptyTarget(value), value, options)
		: value;
}

function defaultArrayMerge(target, source, options) {
	return target.concat(source).map(function (element) {
		return cloneUnlessOtherwiseSpecified(element, options);
	});
}

function getMergeFunction(key, options) {
	if (!options.customMerge) {
		return deepmerge;
	}
	var customMerge = options.customMerge(key);
	return typeof customMerge === 'function' ? customMerge : deepmerge;
}

function getEnumerableOwnPropertySymbols(target) {
	return Object.getOwnPropertySymbols
		? Object.getOwnPropertySymbols(target).filter(function (symbol) {
				return Object.propertyIsEnumerable.call(target, symbol);
			})
		: [];
}

function getKeys(target) {
	return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target));
}

function propertyIsOnObject(object, property) {
	try {
		return property in object;
	} catch (_error) {
		return false;
	}
}

// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target, key) {
	return (
		propertyIsOnObject(target, key) && // Properties are safe to merge if they don't exist in the target yet,
		!(Object.hasOwnProperty.call(target, key) && // unsafe if they exist up the prototype chain,
			Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
	);
}

function mergeObject(target, source, options) {
	var destination = {};
	if (options.isMergeableObject(target)) {
		getKeys(target).forEach(function (key) {
			// GHSA-gcqx-w48m-w2h4: this loop previously copied `__proto__` straight
			// onto `destination`, letting a tainted target poison the result.
			if (isUnsafeKey(key)) {
				return;
			}

			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
		});
	}
	getKeys(source).forEach(function (key) {
		if (isUnsafeKey(key) || propertyIsUnsafe(target, key)) {
			return;
		}

		if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
		} else {
			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
		}
	});
	return destination;
}

function deepmerge(target, source, options) {
	options = options || {};
	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
	options.isMergeableObject = options.isMergeableObject || isMergeableObject;
	// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
	// implementations can use it. The caller may not replace it.
	options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

	var sourceIsArray = Array.isArray(source);
	var targetIsArray = Array.isArray(target);
	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

	if (!sourceAndTargetTypesMatch) {
		return cloneUnlessOtherwiseSpecified(source, options);
	} else if (sourceIsArray) {
		return options.arrayMerge(target, source, options);
	} else {
		return mergeObject(target, source, options);
	}
}

deepmerge.all = function deepmergeAll(array, options) {
	if (!Array.isArray(array)) {
		throw new Error('first argument should be an array');
	}

	return array.reduce(function (prev, next) {
		return deepmerge(prev, next, options);
	}, {});
};

module.exports = deepmerge;
module.exports.default = deepmerge;
module.exports.isMergeableObject = isMergeableObject;
module.exports.deepmerge = deepmerge;
