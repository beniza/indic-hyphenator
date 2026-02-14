/**
 * Indic Hyphenator Logic Tester (Node.js)
 * V2 Simulation - Modular Loading
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("Loading modules...");

function include(relativePath) {
    const filePath = path.join(__dirname, relativePath);
    console.log("  - " + relativePath);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInThisContext(code, { filename: filePath });
}

// Load Modules
include('lib/Polyfills.jsx');
include('lib/Hyphenator.jsx');
include('lib/patterns/ta.jsx');
include('lib/patterns/ml.jsx');
include('lib/patterns/te.jsx');
include('lib/patterns/kn.jsx');

console.log("Modules loaded.\n");

// ==========================================
// V2 LOGIC SIMULATION
// ==========================================

function simulateV2(word, hyphenator, minLen, minB, minA) {
    if (word.length < minLen) return "skipped (length)";

    var points = hyphenator(word);
    var filteredPoints = [];

    for (var k = 0; k < points.length; k++) {
        var idx = points[k];
        // 1. Min Before/After
        if (idx < minB) continue;
        if ((word.length - idx) < minA) continue;

        // 2. Grapheme
        if (isCombiningMark(word[idx])) {
            console.log("   [INFO] Blocked split at " + idx + " because char '" + word[idx] + "' (" + word.charCodeAt(idx).toString(16) + ") is combining.");
            continue;
        }

        filteredPoints.push(idx);
    }

    return JSON.stringify(filteredPoints);
}

console.log("\n--- V2 Test Results ---");

if (typeof Patterns === 'undefined' || !Patterns.ta) {
    console.error("ERROR: Patterns not loaded correctly.");
    process.exit(1);
}

var h = createHyphenator([Patterns.ta[0], Patterns.ta[1], {}]);

// Test 1: Min Length
console.log("Min Length (3) on 'it': " + simulateV2("it", h, 3, 2, 2));

// Test 2: Min Before/After
// 'வணக்கம்' -> [4] (index 4 is 'க')
// Length 6. 
console.log("MinBefore 5 on 'வணக்கம்' (index 4): " + simulateV2("வணக்கம்", h, 3, 5, 2));
console.log("MinBefore 2 on 'வணக்கம்' (index 4): " + simulateV2("வணக்கம்", h, 3, 2, 2));

// Test 3: Grapheme Block
// We simulate a bad split point manually by forcing the engine to find one?
// Hard to force the engine if patterns are good.
// But we can check isCombiningMark logic directly.
var virama = "\u0BCD";
console.log("Is Virama combining? " + isCombiningMark(virama));

// Test 4: Malayalam basic
var hm = createHyphenator([Patterns.ml[0], Patterns.ml[1], {}]);
console.log("Malayalam 'കേരളം': " + simulateV2("കേരളം", hm, 3, 2, 2));