const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Loading modules...");

function include(relativePath) {
    const filePath = path.join(__dirname, '../', relativePath);
    // console.log("  - " + relativePath);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInThisContext(code, { filename: filePath });
}

// Load Modules globally
include('lib/Polyfills.jsx');
include('lib/Hyphenator.jsx');
include('lib/patterns/ta.jsx');
include('lib/patterns/ml.jsx');
include('lib/patterns/te.jsx');
include('lib/patterns/kn.jsx');

console.log("Modules loaded.\n");

if (typeof Patterns === 'undefined') {
    console.error("ERROR: Patterns not loaded correctly.");
    process.exit(1);
}

module.exports = {
    // Export anything if needed, but the includes put things in global scope
};
