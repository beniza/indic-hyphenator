// ============================================================================================
// V2 LOGIC SIMULATION
// ============================================================================================

function simulateV2(word, hyphenator, minSyllables, minSyllBefore, minSyllAfter, rules) {
    // 1. Blacklist Check (exact whole-word match)
    if (rules && rules.blacklist && rules.blacklist.length > 0) {
        for (var b = 0; b < rules.blacklist.length; b++) {
            if (word === rules.blacklist[b]) return "skipped (blacklist)";
        }
    }

    // 2. Min syllable count check (replaces code-point length check)
    var totalSyll = countSyllables(word);
    if (totalSyll < minSyllables) return "skipped (syllables: " + totalSyll + ")";

    var points = hyphenator(word);

    var filteredPoints = [];

    for (var k = 0; k < points.length; k++) {
        var idx = points[k];

        // 3. Grapheme integrity: don't split onto a combining mark
        if (isCombiningMark(word[idx])) continue;

        // 4. Syllable-based min before/after
        var leftPart = word.substring(0, idx);
        var rightPart = word.substring(idx);
        var syllBefore = countSyllables(leftPart);
        var syllAfter = countSyllables(rightPart);
        if (syllBefore < minSyllBefore) continue;
        if (syllAfter < minSyllAfter) continue;

        // 5. Rules: Do Not Break Before
        if (rules && rules.doNotBreakBefore) {
            if (rules.doNotBreakBefore.indexOf(word[idx]) !== -1) continue;
        }

        // 6. Bad Fragment Check
        if (rules && rules.badFragments) {
            var fragment = word.substring(0, idx);
            var blocked = false;
            for (var bf = 0; bf < rules.badFragments.length; bf++) {
                if (fragment === rules.badFragments[bf]) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;
        }

        filteredPoints.push(idx);
    }

    return filteredPoints;
}

function applyHyphens(word, points, char) {
    char = char || "-";
    var result = "";
    var last = 0;
    points.sort(function (a, b) { return a - b });

    for (var i = 0; i < points.length; i++) {
        result += word.substring(last, points[i]) + char;
        last = points[i];
    }
    result += word.substring(last);
    return result;
}

module.exports = {
    simulateV2: simulateV2,
    applyHyphens: applyHyphens
};
