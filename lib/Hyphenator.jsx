// ============================================================================================
// HYPHENATION ENGINE
// Adapted from https://github.com/ytiurin/hyphen/blob/master/hyphen.js
// ============================================================================================

var createHyphenator = (function () {
    function createTextReader(setup) {
        var char1 = "";
        var char2 = "";
        var i = 0;
        var verifier = setup();
        return function (text) {
            while (i < text.length) {
                char1 = text.charAt(i++);
                char2 = text.charAt(i);
                var verified = verifier(char1, char2);
                if (verified !== void 0) {
                    return verified;
                }
            }
        };
    }

    var isNotLetter = RegExp.prototype.test.bind(
        /\s|(?![\'])[\!-\@\[-\`\{-\~\u2013-\u203C]/
    );
    function createHTMLVerifier() {
        var skip = false;
        return function (accumulate, chars) {
            if (skip) {
                if (chars[0] === ">") {
                    accumulate();
                    skip = false;
                }
            } else if (
                chars[0] === "<" &&
                (!isNotLetter(chars[1]) || chars[1] === "/")
            ) {
                skip = true;
            }
            return skip;
        };
    }
    function createHyphenCharVerifier(hyphenChar) {
        var skip = false;
        return function (accumulate, chars) {
            if (skip) {
                if (!isNotLetter(chars[0]) && isNotLetter(chars[1])) {
                    accumulate();
                    skip = false;
                }
            } else if (!isNotLetter(chars[0]) && chars[1] === hyphenChar) {
                skip = true;
            }
            return skip;
        };
    }
    function createHyphenationVerifier(verifiers, minWordLength) {
        return function () {
            var accum0 = "";
            var accum = "";
            function accumulate() {
                accum0 += accum;
                accum = "";
            }
            function resolveWith(value) {
                accum0 = "";
                accum = "";
                return value;
            }
            return function (char1, char2) {
                accum += char1;
                var skip = verifiers.reduce(function (skip2, verify) {
                    return skip2 || verify(accumulate, [char1, char2]);
                }, false);
                if (!skip) {
                    if (isNotLetter(char1) && !isNotLetter(char2)) {
                        accumulate();
                    }
                    if (!isNotLetter(char1) && isNotLetter(char2)) {
                        if (accum.length >= minWordLength) {
                            return resolveWith([accum0, accum]);
                        } else {
                            accumulate();
                        }
                    }
                }
                if (char2 === "") {
                    if (accum.length < minWordLength || skip) {
                        accumulate();
                    }
                    return resolveWith([accum0, accum]);
                }
            };
        };
    }

    function levelsToMarkers(levels) {
        var markers = [];
        for (var i = 0; i < levels.length; i++)
            if ((levels[i] & 1) === 1) markers.push(i);
        return markers;
    }
    function insertChar(text, hyphenChar, markers) {
        if (markers.length === 0) {
            return text;
        }
        var resultText = [text.slice(0, markers[0])];
        if (markers.length > 1)
            for (var i = 0, j = 1; j < markers.length; i++, j++) {
                resultText.push(text.slice(markers[i], markers[j]));
            }
        resultText.push(text.slice(markers[markers.length - 1]));
        return resultText.join(hyphenChar);
    }
    function markersFromExceptionsDefinition(exceptionsList) {
        return exceptionsList.reduce(function (markersDict, definition) {
            var i = 0,
                markers = [];
            while ((i = definition.indexOf("-", i + 1)) > -1) {
                markers.push(i);
            }
            markersDict[definition.toLocaleLowerCase().replace(/\-/g, "")] = markers;
            return markersDict;
        }, {});
    }

    function createCharIterator(str) {
        var i = 0;
        function nextChar() {
            return str[i++];
        }
        return nextChar;
    }
    function createStringSlicer(str) {
        var i = 0,
            slice = str;
        function next() {
            slice = str.slice(i++);
            if (slice.length < 3) {
                return;
            }
            return slice;
            // eslint-disable-next-line no-unreachable
        }
        function isFirstCharacter() {
            return i === 2;
        }
        return [next, isFirstCharacter];
    }

    function hyphenateWord(text, loweredText, levelsTable, patternTrie) {
        var levels = new Array(text.length + 1),
            loweredText = ("." + loweredText + ".").split(""),
            wordSlice,
            letter,
            triePtr,
            trieNode,
            patternLevelsIndex,
            patternLevels,
            patternEntityIndex = -1,
            slicer,
            nextSlice,
            isFirstCharacter,
            nextLetter;
        for (var i = levels.length; i--;) levels[i] = 0;
        slicer = createStringSlicer(loweredText);
        nextSlice = slicer[0];
        isFirstCharacter = slicer[1];
        while ((wordSlice = nextSlice())) {
            patternEntityIndex++;
            if (isFirstCharacter()) {
                patternEntityIndex--;
            }
            triePtr = patternTrie;
            nextLetter = createCharIterator(wordSlice);
            while ((letter = nextLetter())) {
                if ((trieNode = triePtr[letter]) === void 0) {
                    break;
                }
                triePtr = {};
                patternLevelsIndex = -1;
                switch (Object.prototype.toString.call(trieNode)) {
                    case "[object Array]":
                        triePtr = trieNode[0];
                        patternLevelsIndex = trieNode[1];
                        break;
                    case "[object Object]":
                        triePtr = trieNode;
                        break;
                    case "[object Number]":
                        patternLevelsIndex = trieNode;
                        break;
                }
                if (patternLevelsIndex < 0) {
                    continue;
                }
                patternLevels = levelsTable[patternLevelsIndex];
                for (var k = 0; k < patternLevels.length; k++)
                    levels[patternEntityIndex + k] = Math.max(
                        patternLevels[k],
                        levels[patternEntityIndex + k]
                    );
            }
        }
        levels[0] = levels[1] = levels[levels.length - 1] = levels[
            levels.length - 2
        ] = 0;
        return levelsToMarkers(levels);
    }

    function start(
        text,
        levelsTable,
        patterns,
        cache,
        markersDict,
        hyphenChar,
        skipHTML,
        minWordLength,
        isAsync
    ) {
        // Synchronous implementation only for InDesign
        var newText = "",
            fragments,
            readText = createTextReader(
                createHyphenationVerifier(
                    (skipHTML ? [createHTMLVerifier()] : []).concat(
                        createHyphenCharVerifier(hyphenChar)
                    ),
                    minWordLength
                )
            );

        return {
            hyphenate: function (word) {
                var loweredWord = word.toLocaleLowerCase();
                return hyphenateWord(word, loweredWord, levelsTable, patterns);
            }
        };
    }

    function createHyphenator(patternsDefinition, options) {
        var levelsTable = patternsDefinition[0],
            patterns = patternsDefinition[1];

        // Expose a simple hyphenate function
        return function (word) {
            var loweredWord = word.toLocaleLowerCase();
            return hyphenateWord(word, loweredWord, levelsTable, patterns);
        };
    }

    return createHyphenator;
})();

function isCombiningMark(char) {
    if (!char) return false;
    var code = char.charCodeAt(0);
    // Tamil: 0B82-0B83 (Signs), 0BBE-0BCD (Matras/Virama), 0BD7 (Au length)
    if ((code >= 0x0B82 && code <= 0x0B83) || (code >= 0x0BBE && code <= 0x0BCD) || code === 0x0BD7) return true;

    // Malayalam: 0D02-0D03, 0D3E-0D4D, 0D57
    if ((code >= 0x0D02 && code <= 0x0D03) || (code >= 0x0D3E && code <= 0x0D4D) || code === 0x0D57) return true;

    // Telugu: 0C01-0C03, 0C3E-0C4D, 0C55-0C56
    if ((code >= 0x0C01 && code <= 0x0C03) || (code >= 0x0C3E && code <= 0x0C4D) || (code >= 0x0C55 && code <= 0x0C56)) return true;

    // Kannada: 0C82-0C83, 0CBE-0CCD, 0CD5-0CD6
    if ((code >= 0x0C82 && code <= 0x0C83) || (code >= 0x0CBE && code <= 0x0CCD) || (code >= 0x0CD5 && code <= 0x0CD6)) return true;

    return false;
}

// ============================================================================================
// SYLLABLE DETECTION
// Ported from MarkDravidianHyphenatedWords.py by Dan M
// ============================================================================================

function getSyllables(word) {
    // Unicode ranges from the Python reference:
    // Independent vowels
    var indVowels = "\u0B85-\u0B94"       // Tamil
        + "\u0B05-\u0B14\u0B60\u0B61"  // Oriya
        + "\u0C05-\u0C14\u0C60\u0C61"  // Telugu
        + "\u0C85-\u0C94\u0CE0\u0CE1"  // Kannada
        + "\u0D05-\u0D14\u0D60\u0D61"; // Malayalam

    // Vowel modifiers / stress marks
    var vmod = "\u0324"                     // Combining diaeresis (temp)
        + "\u0B82"                     // Tamil
        + "\u0B01-\u0B03\u0B4D"        // Oriya
        + "\u0C01-\u0C03\u0C4D"        // Telugu
        + "\u0C82-\u0C83\u0CBD"        // Kannada
        + "\u0D02-\u0D03\u0D3D";       // Malayalam

    // Consonant modifiers (nukta etc.)
    var cmod = "\u0324\u0CBC\u0B3C";

    // Consonants (excluding Malayalam Chillu U+0D7A-0D7F, which are coda-only)
    var cons = "\u0B95-\u0BB9"              // Tamil
        + "\u0B15-\u0B39\u0B5C\u0B5D\u0B5F\u0B70\u0B71" // Oriya
        + "\u0C15-\u0C39\u0C58\u0C59"  // Telugu
        + "\u0C95-\u0CB9\u0CDE"        // Kannada
        + "\u0D15-\u0D39";             // Malayalam (regular consonants only)

    // Malayalam Chillu characters — treated as separate syllable units for
    // hyphenation purposes because they visually occupy a full character width.
    var chillus = "\u0D7A-\u0D7F";

    // Matras
    var matras = "\u0BBE-\u0BCC\u0BD7"       // Tamil (note: corrected from Python's 0BBC)
        + "\u0B3E-\u0B4C\u0B56\u0B57\u0B62\u0B63" // Oriya
        + "\u0C3E-\u0C4C\u0C55\u0C56\u0C62\u0C63" // Telugu
        + "\u0CBE-\u0CCC\u0CD5\u0CD6\u0CE2\u0CE3" // Kannada
        + "\u0D3E-\u0D4C\u0D57\u0D62\u0D63";       // Malayalam

    // Viramas
    var viramas = "\u0BCD"    // Tamil
        + "\u0B4D"    // Oriya
        + "\u0C4D"    // Telugu
        + "\u0CCD"    // Kannada
        + "\u0D4D";   // Malayalam

    // Build syllable patterns (same logic as Python):
    // consPattern = consonant + optional consonant modifiers
    var consP = "[" + cons + "][" + cmod + "]*";
    // viramasPattern = virama + optional ZWJ/ZWNJ
    var viramaP = "[" + viramas + "][\u200C\u200D\u0324]*";
    // optMatras = optional matras and vowel modifiers
    var optMatras = "[" + matras + vmod + "]*";

    // Syllable type 1: (Cons+Virama)* Cons OptMatras (normal syllable, no chillu coda)
    var syll1 = "(?:(?:" + consP + viramaP + ")*" + consP + optMatras + ")";
    // Syllable type 3: Independent vowel + optional modifiers (no chillu coda)
    var syll3 = "(?:[" + indVowels + "][" + vmod + "]*)";
    // Syllable type 4: Chillu character as its own syllable unit
    var syll4 = "(?:[" + chillus + "])";

    var syllPattern = new RegExp("(" + syll1 + "|" + syll3 + "|" + syll4 + ")", "g");

    var matches = word.match(syllPattern);
    return matches || [];
}

function countSyllables(word) {
    return getSyllables(word).length;
}
