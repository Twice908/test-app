'use strict';

// Tiny shared helpers used by the mock agents and routes.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Inclusive random integer in [min, max].
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { sleep, randInt };
