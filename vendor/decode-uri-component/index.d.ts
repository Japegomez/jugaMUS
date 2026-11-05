/**
 * Decodes a Uniform Resource Identifier (URI) component previously created by
 * `encodeURIComponent()` or by a similar routine.
 *
 * Declared as a CommonJS callable (`export =`) so consumers that do
 * `require('decode-uri-component')(...)` type-check correctly against this shim.
 */
declare function decodeUriComponent(encodedURI: string): string

export = decodeUriComponent
