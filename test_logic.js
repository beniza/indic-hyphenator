/**
 * Indic Hyphenator Logic Tester (Node.js)
 * V2 Simulation
 */

// ============================================================================================
// POLYFILLS
// ============================================================================================

if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
        if (typeof this !== "function") throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        var aArgs = Array.prototype.slice.call(arguments, 1),
            fToBind = this,
            fNOP = function () { },
            fBound = function () {
                return fToBind.apply(this instanceof fNOP && oThis ? this : oThis,
                    aArgs.concat(Array.prototype.slice.call(arguments)));
            };
        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();
        return fBound;
    };
}

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
        var k;
        if (this == null) throw new TypeError('"this" is null or not defined');
        var O = Object(this);
        var len = O.length >>> 0;
        if (len === 0) return -1;
        var n = +fromIndex || 0;
        if (Math.abs(n) === Infinity) n = 0;
        if (n >= len) return -1;
        k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        while (k < len) {
            if (k in O && O[k] === searchElement) return k;
            k++;
        }
        return -1;
    };
}

if (!Array.prototype.reduce) {
    Array.prototype.reduce = function (callback) {
        if (this === null) throw new TypeError('Array.prototype.reduce called on null or undefined');
        if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
        var t = Object(this), len = t.length >>> 0, k = 0, value;
        if (arguments.length == 2) {
            value = arguments[1];
        } else {
            while (k < len && !(k in t)) k++;
            if (k >= len) throw new TypeError('Reduce of empty array with no initial value');
            value = t[k++];
        }
        for (; k < len; k++) {
            if (k in t) value = callback(value, t[k], k, t);
        }
        return value;
    };
}

if (!Object.keys) {
    Object.keys = (function () {
        'use strict';
        var hasOwnProperty = Object.prototype.hasOwnProperty,
            hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
            dontEnums = [
                'toString',
                'toLocaleString',
                'valueOf',
                'hasOwnProperty',
                'isPrototypeOf',
                'propertyIsEnumerable',
                'constructor'
            ],
            dontEnumsLength = dontEnums.length;

        return function (obj) {
            if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
                throw new TypeError('Object.keys called on non-object');
            }
            return [];
        };
    }());
}

// ============================================================================================
// HYPHENATION ENGINE
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

// ============================================================================================
// PATTERNS
// ============================================================================================

var Patterns = {};

Patterns.ta = [
    [[2, 2], [1, 1], [0, 1], [1], [2, 0, 1], [2, 1]],
    {
        "\u200D": 0, "\u200C": 1,
        "அ": 1, "ஆ": 1, "இ": 1, "ஈ": 1, "உ": 1, "ஊ": 1, "எ": 1, "ஏ": 1, "ஐ": 1, "ஒ": 1, "ஓ": 1, "ஔ": 1,
        "ா": 2, "ி": 2, "ீ": 2, "ு": 2, "ூ": 2, "ெ": 2, "ே": 2, "ை": 2, "ொ": 2, "ோ": 2, "ௌ": 2,
        "க": [{ "்": 4 }, 3], "ங": [{ "்": 4 }, 3], "ச": [{ "்": 4 }, 3], "ஜ": 3, "ஞ": [{ "்": 4 }, 3],
        "ட": [{ "்": 4 }, 3], "ண": [{ "்": 4 }, 3], "த": [{ "்": 4 }, 3], "ந": [{ "்": 4 }, 3],
        "ப": [{ "்": 4 }, 3], "ம": [{ "்": 4 }, 3], "ய": [{ "்": 4 }, 3], "ர": [{ "்": 4 }, 3],
        "ற": [{ "்": 4 }, 3], "ல": [{ "்": 4 }, 3], "ள": [{ "்": 4 }, 3], "ழ": [{ "்": 4 }, 3],
        "வ": [{ "்": 4 }, 3], "ஷ": [{ "்": 4 }, 3], "ஸ": [{ "்": 4 }, 3], "ஹ": [{ "்": 4 }, 3],
        "ன": { "்": 4 },
        "ஂ": 5, "ஃ": 5, "ௗ": 5, "்": 5
    },
    {}
];

Patterns.ml = [
    [[2, 2], [1, 1], [0, 1], [1], [2, 1], [0, 0, 2], [2]],
    {
        "\u200D": 0, "\u200C": 1,
        "അ": 1, "ആ": 1, "ഇ": 1, "ഈ": 1, "ഉ": 1, "ഊ": 1, "ഋ": 1, "ൠ": 1, "ഌ": 1, "ൡ": 1,
        "എ": 1, "ഏ": 1, "ഐ": 1, "ഒ": 1, "ഓ": 1, "ഔ": 1,
        "ാ": 2, "ി": 2, "ീ": 2, "ു": 2, "ൂ": 2, "ൃ": 2, "െ": 2, "േ": 2, "ൈ": 2, "ൊ": 2, "ോ": 2, "ൌ": 2, "ൗ": 2,
        "ക": [{ "്": [{ "‍": 6 }, 5] }, 3], "ഖ": 3, "ഗ": 3, "ഘ": 3, "ങ": 3,
        "ച": 3, "ഛ": 3, "ജ": 3, "ഝ": 3, "ഞ": 3,
        "ട": 3, "ഠ": 3, "ഡ": 3, "ഢ": 3, "ണ": [{ "്": [{ "‍": 6 }, 5] }, 3],
        "ത": 3, "ഥ": 3, "ദ": 3, "ധ": 3, "ന": [{ "്": [{ "‍": 6 }, 5] }, 3],
        "പ": 3, "ഫ": 3, "ബ": 3, "ഭ": 3, "മ": 3,
        "യ": 3, "ര": [{ "്": [{ "‍": 6 }, 5] }, 3], "റ": 3,
        "ല": [{ "്": [{ "‍": 6 }, 5] }, 3], "ള": [{ "്": [{ "‍": 6 }, 5] }, 3],
        "ഴ": 3, "വ": 3, "ശ": 3, "ഷ": 3, "സ": 3, "ഹ": 3,
        "ഃ": 4, "ം": 4, "്": 0,
        "ൺ": 6, "ൻ": 6, "ർ": 6, "ൽ": 6, "ൾ": 6, "ൿ": 6
    },
    {}
];

Patterns.te = [
    [[2, 2], [1, 1], [0, 1], [1], [2, 1]],
    {
        "\u200D": 0, "\u200C": 1,
        "అ": 2, "ఆ": 2, "ఇ": 2, "ఈ": 2, "ఉ": 2, "ఊ": 2, "ఋ": 2, "ౠ": 2, "ఌ": 2, "ౡ": 2,
        "ఎ": 2, "ఏ": 2, "ఐ": 2, "ఒ": 2, "ఓ": 2, "ఔ": 2,
        "ా": 2, "ి": 2, "ీ": 2, "ు": 2, "ూ": 2, "ృ": 2, "ౄ": 2, "ె": 2, "ే": 2, "ై": 2, "ొ": 2, "ో": 2, "ౌ": 2,
        "క": 3, "ఖ": 3, "గ": 3, "ఘ": 3, "ఙ": 3,
        "చ": 3, "ఛ": 3, "జ": 3, "ఝ": 3, "ఞ": 3,
        "ట": 3, "ఠ": 3, "డ": 3, "ఢ": 3, "ణ": 3,
        "త": 3, "థ": 3, "ద": 3, "ಧ": 3, "న": 3,
        "ప": 3, "ఫ": 3, "బ": 3, "భ": 3, "మ": 3,
        "య": 3, "ర": 3, "ఱ": 3, "ల": 3, "ళ": 3, "వ": 3, "శ": 3, "ష": 3, "స": 3, "హ": 3,
        "ఁ": 4, "ం": 4, "ః": 4, "ౕ": 4, "ౖ": 4, "్": 0
    },
    {}
];

Patterns.kn = [
    [[2, 2], [1, 1], [0, 1], [1], [2, 1]],
    {
        "\u200D": 0, "\u200C": 1,
        "ಅ": 2, "ఆ": 2, "ఇ": 2, "ಈ": 2, "ಉ": 2, "ಊ": 2, "ಋ": 2, "ೠ": 2, "ಌ": 2, "ೡ": 2,
        "ಎ": 2, "ಏ": 2, "ಐ": 2, "ಒ": 2, "ಓ": 2, "ಔ": 2,
        "ಾ": 2, "ి": 2, "ೀ": 2, "ು": 2, "ೂ": 2, "ೃ": 2, "ೄ": 2, "ೆ": 2, "ೇ": 2, "ೈ": 2, "ೊ": 2, "ೋ": 2, "ೌ": 2,
        "ಕ": 3, "ఖ": 3, "గ": 3, "ఘ": 3, "ಙ": 3,
        "చ": 3, "ఛ": 3, "ಜ": 3, "ಝ": 3, "ಞ": 3,
        "ಟ": 3, "ఠ": 3, "ಡ": 3, "ಢ": 3, "ಣ": 3,
        "ತ": 3, "ಥ": 3, "ದ": 3, "ಧ": 3, "ನ": 3,
        "ಪ": 3, "ಫ": 3, "ಬ": 3, "ಭ": 3, "ಮ": 3,
        "ಯ": 3, "ರ": 3, "ಱ": 3, "ಲ": 3, "ಳ": 3, "ೞ": 3, "ವ": 3, "ಶ": 3, "ಷ": 3, "ಸ": 3, "ಹ": 3,
        "ಂ": 4, "ಃ": 4, "ಽ": 4, "ೕ": 4, "ೖ": 4, "್": 0
    },
    {}
];

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