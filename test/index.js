// Main Test Runner

console.log("Starting Tests...\n");

// 1. Setup Environment
require('./setup');

// 2. Check for CLI Args
var args = process.argv.slice(2);
if (args.length > 0) {
    var input = args[0];
    var lang = "ml"; // Default to Malayalam
    if (args.length > 1) lang = args[1];

    if (!Patterns[lang]) {
        console.error("Language '" + lang + "' not found.");
        process.exit(1);
    }

    var hm = createHyphenator([Patterns[lang][0], Patterns[lang][1], {}]);
    var rules = Patterns[lang].rules || {};

    const { simulateV2, applyHyphens } = require('./utils');

    // Split input into words and non-words (spaces, punctuation)
    // Process each word independently, preserve separators
    var tokens = input.match(/[\u0B00-\u0D7F\u200C\u200D]+|[^\u0B00-\u0D7F\u200C\u200D]+/g) || [input];
    var result = "";

    for (var t = 0; t < tokens.length; t++) {
        var token = tokens[t];
        // Check if token contains Indic characters
        if (/[\u0B00-\u0D7F]/.test(token)) {
            var points = simulateV2(token, hm, 3, 2, 2, rules);
            if (typeof points === "string") {
                result += token; // skipped, keep as-is
            } else {
                result += applyHyphens(token, points, "-");
            }
        } else {
            result += token; // punctuation/space, keep as-is
        }
    }

    console.log(result);

} else {
    // 3. Run Specs
    require('./specs/general.test.js');
    require('./specs/malayalam.test.js');

    console.log("\nTests Completed.");
}
