const { simulateV2 } = require('../utils');

console.log("--- General Tests ---");

if (!Patterns.ta) {
    console.error("Patterns not loaded!");
    return;
}

var h = createHyphenator([Patterns.ta[0], Patterns.ta[1], {}]);

// Test 1: Min Length (syllable-based)
// 'it' has 0 Indic syllables -> should be skipped
console.log("Min Length on 'it': " + JSON.stringify(simulateV2("it", h, 3, 2, 2)));

// Test 2: Tamil word
console.log("Tamil 'வணக்கம்': " + JSON.stringify(simulateV2("வணக்கம்", h, 3, 2, 2)));

// Test 3: Grapheme Block
var virama = "\u0BCD";
console.log("Is Virama combining? " + isCombiningMark(virama));

// Test 4: Syllable counting
console.log("Syllables in 'வணக்கம்': " + countSyllables("வணக்கம்"));
console.log("Syllables in 'നമുക്ക്': " + countSyllables("നമുക്ക്"));
console.log("Syllables in 'അർപ്പണമനോഭാവത്താലുള്ള': " + countSyllables("അർപ്പണമനോഭാവത്താലുള്ള"));
