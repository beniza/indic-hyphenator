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
