const { simulateV2 } = require('../utils');

console.log("\n--- Malayalam Tests ---");

var hm = createHyphenator([Patterns.ml[0], Patterns.ml[1], {}]);

// Test 1: Basic Malayalam word
console.log("Malayalam 'കേരളം': " + JSON.stringify(simulateV2("കേരളം", hm, 3, 2, 2, Patterns.ml.rules)));

// Test 2: Short word should be skipped (3 syllables, minSyllables=3 is borderline, <3 skipped)
console.log("Short 'നമുക്ക്' (expect skipped): " + JSON.stringify(simulateV2("നമുക്ക്", hm, 4, 2, 2, Patterns.ml.rules)));

// Test 3: Blacklist
Patterns.ml.rules.blacklist = ["badword"];
console.log("Blacklist 'badword': " + JSON.stringify(simulateV2("badword", hm, 3, 2, 2, Patterns.ml.rules)));
Patterns.ml.rules.blacklist = [];

// Test 4: Do Not Break Before (Chillu)
var testRules = {
    doNotBreakBefore: Patterns.ml.rules.doNotBreakBefore + "\u0D30", // Add Ra
    blacklist: [],
    badFragments: []
};
console.log("Block 'ര' on 'കേരളം' (expect [3]): " + JSON.stringify(simulateV2("കേരളം", hm, 3, 2, 2, testRules)));

// Test 5: Bad Fragments
console.log("Bad Fragment 'വെടിവയ്പ്പ്': " + JSON.stringify(simulateV2("വെടിവയ്പ്പ്", hm, 3, 2, 2, Patterns.ml.rules)));

// Test 6: User's test sentence words
console.log("\n--- User Sentence Words ---");
console.log("'അർപ്പണമനോഭാവത്താലുള്ള': " + JSON.stringify(simulateV2("അർപ്പണമനോഭാവത്താലുള്ള", hm, 3, 2, 2, Patterns.ml.rules)));
console.log("'പ്രയത്നത്താൽ': " + JSON.stringify(simulateV2("പ്രയത്നത്താൽ", hm, 3, 2, 2, Patterns.ml.rules)));
console.log("'നമുക്ക്': " + JSON.stringify(simulateV2("നമുക്ക്", hm, 3, 2, 2, Patterns.ml.rules)));
console.log("'പൂർണമായും': " + JSON.stringify(simulateV2("പൂർണമായും", hm, 3, 2, 2, Patterns.ml.rules)));
console.log("'അഭിമാനിക്കാം': " + JSON.stringify(simulateV2("അഭിമാനിക്കാം", hm, 3, 2, 2, Patterns.ml.rules)));
