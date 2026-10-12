'use strict';

// Keep payment-rail capabilities dependency-free so quote, verification and
// checkout services can import them without creating an initialization cycle.
const SUPPORTED_ASSETS = Object.freeze(['BTC']);

module.exports = { SUPPORTED_ASSETS };
