// Tiny shim that replaces the isomorphic-webcrypto/react-native bundle pulled
// in by lib0 (a yjs dependency).  The library only needs `getRandomValues`,
// `subtle` (not exercised in RN) and an `ensureSecure()` call at import time.
// @ts-nocheck — intentional CJS/ESM mixing for Metro shim compatibility
const { getRandomValues } = require('expo-crypto');

const ensureSecure = () => {};

// lib0's react-native CJS does:
//   var webcrypto = require('isomorphic-webcrypto/src/react-native')
//   webcrypto.default.ensureSecure()
//   const subtle    = webcrypto.default.subtle
//   const getRandomValues = webcrypto.default.getRandomValues.bind(webcrypto.default)
//   exports.getRandomValues = getRandomValues;  exports.subtle = subtle;
// So the default export must carry those three keys, and the CJS module must
// re-export default as both `default` and as the top-level object.

const defaultExport = { ensureSecure, subtle: undefined, getRandomValues };

module.exports = defaultExport;
module.exports.default = defaultExport;
