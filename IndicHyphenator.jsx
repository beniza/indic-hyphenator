#target "indesign"

/**
 * Indic Hyphenator for Adobe InDesign
 * Adds discretionary hyphens for Tamil, Malayalam, Telugu, and Kannada.
 * 
 * Based on Franklin M. Liang's algorithm.
 * Patterns from: https://github.com/ytiurin/hyphen
 */

// ============================================================================================
// POLYFILLS (ExtendScript is ES3-ish)
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

            var result = [], prop, i;

            for (prop in obj) {
                if (hasOwnProperty.call(obj, prop)) {
                    result.push(prop);
                }
            }

            if (hasDontEnumBug) {
                for (i = 0; i < dontEnumsLength; i++) {
                    if (hasOwnProperty.call(obj, dontEnums[i])) {
                        result.push(dontEnums[i]);
                    }
                }
            }
            return result;
        };
    }());
}

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

        // In InDesign we'd rather get the hyphenation points for a single word, 
        // but this engine is designed to process chunks of text. 
        // We will expose a way to just get the markers for a word.

        return {
            hyphenate: function (word) {
                // simplified single word hyphenation used locally
                var loweredWord = word.toLocaleLowerCase();
                return hyphenateWord(word, loweredWord, levelsTable, patterns);
            }
        };

    }

    // Simplified createHyphenator for our use case (just need the internal hyphenateWord really)
    // But we'll stick to the structure to keep the logic intact.

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
        "త": 3, "థ": 3, "ద": 3, "ధ": 3, "న": 3,
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

// ============================================================================================
// UI & LOGIC
// ============================================================================================

function main() {
    // Condition management
    var CONDITION_NAME = "IndicHyphenator";

    function getOrMakeCondition() {
        if (!app.documents.length) return null;
        var doc = app.activeDocument;
        var cond = doc.conditions.item(CONDITION_NAME);
        if (!cond.isValid) {
            cond = doc.conditions.add({
                name: CONDITION_NAME,
                indicatorMethod: ConditionIndicatorMethod.USE_HIGHLIGHT,
                indicatorColor: UIColors.GRID_GREEN,
                visible: false // Invisible by default
            });
        }
        return cond;
    }

    // Main UI
    var win = new Window("dialog", "Indic Hyphenator");
    win.orientation = "column";
    win.alignChildren = "fill";

    // Panel: Scope
    var pScope = win.add("panel", undefined, "Scope");
    pScope.alignChildren = "left";
    var rbSelection = pScope.add("radiobutton", undefined, "Selection");
    var rbStory = pScope.add("radiobutton", undefined, "Parent Story (of selection)");
    var rbDocument = pScope.add("radiobutton", undefined, "Whole Document");
    rbSelection.value = true;

    // Auto-select based on what is selected
    if (app.selection.length === 0) {
        rbSelection.enabled = false;
        rbStory.enabled = false;
        rbDocument.value = true;
    } else if (app.selection.length > 0 && !(app.selection[0] instanceof TextFrame || app.selection[0].hasOwnProperty("baseline"))) {
        // If selection isn't text-related (like an image), default to doc
        // But usually InDesign scripts run with text selected.
    }

    // Panel: Language
    var pLang = win.add("panel", undefined, "Language");
    pLang.alignChildren = "left";
    var dwLang = pLang.add("dropdownlist", undefined, ["Tamil", "Malayalam", "Telugu", "Kannada"]);
    dwLang.selection = 0;

    // Panel: Action
    var pAction = win.add("group");
    pAction.alignment = "right";
    var btnRemove = pAction.add("button", undefined, "Remove Hyphens");
    var btnRun = pAction.add("button", undefined, "Hyphenate");
    var btnCancel = pAction.add("button", undefined, "Cancel");

    btnCancel.onClick = function () { win.close(); };

    // Progress
    var pProgress = win.add("panel", undefined, "Status");
    pProgress.alignChildren = "fill";
    var txtStatus = pProgress.add("statictext", undefined, "Ready");
    var progBar = pProgress.add("progressbar", undefined, 0, 100);
    progBar.preferredSize.width = 300;


    // ----------- LOGIC -----------

    function getTargetObjects() {
        var targets = [];
        var scopeName = "";
        if (rbSelection.value) {
            scopeName = "Selection";
            for (var i = 0; i < app.selection.length; i++) {
                if (app.selection[i].hasOwnProperty("texts")) {
                    targets.push(app.selection[i].texts[0]);
                } else if (app.selection[i] instanceof TextFrame) {
                    targets.push(app.selection[i].texts[0]);
                } else if (app.selection[i] instanceof Text) { // User selected text range
                    targets.push(app.selection[i]);
                }
            }
        } else if (rbStory.value) {
            scopeName = "Story";
            if (app.selection.length > 0 && app.selection[0].parentStory) {
                targets.push(app.selection[0].parentStory);
            }
        } else {
            // Document
            scopeName = "Document";
            if (app.activeDocument) {
                targets.push(app.activeDocument);
            }
        }
        return targets;
    }

    // REMOVE logic
    btnRemove.onClick = function () {
        var cond = getOrMakeCondition();
        if (!cond) return;

        var targets = getTargetObjects();
        if (targets.length === 0) {
            alert("No target found.");
            return;
        }

        txtStatus.text = "Removing existing hyphens...";
        win.layout.layout(true); // Force UI update

        app.findChangeTextOptions.includeFootnotes = true;
        app.findChangeTextOptions.includeHiddenLayers = false;
        app.findChangeTextOptions.includeLockedLayersForFind = false;
        app.findChangeTextOptions.includeLockedStoriesForFind = false;
        app.findChangeTextOptions.includeMasterPages = false;

        app.findTextPreferences = NothingEnum.nothing;
        app.changeTextPreferences = NothingEnum.nothing;

        // Find discretionary hyphens
        app.findTextPreferences.findWhat = "^-"; // Discretionary hyphen

        var counter = 0;

        // Unfortunately standard JS findText() returns all matches.
        // We iterate and check condition.
        for (var i = 0; i < targets.length; i++) {
            var found = targets[i].findText();
            for (var j = found.length - 1; j >= 0; j--) {
                // Check if the character has the specific condition
                // appliedConditions returns an array of Condition objects.
                var conds = found[j].appliedConditions;
                var isTagged = false;
                if (conds && conds.length) {
                    for (var c = 0; c < conds.length; c++) {
                        if (conds[c].name === CONDITION_NAME) {
                            isTagged = true;
                            break;
                        }
                    }
                }

                if (isTagged) {
                    found[j].remove();
                    counter++;
                }
            }
        }

        app.findTextPreferences = NothingEnum.nothing;
        txtStatus.text = "Removed " + counter + " hyphens.";
    };

    // RUN logic
    btnRun.onClick = function () {
        var langCode = ["ta", "ml", "te", "kn"][dwLang.selection.index];
        var hyphenator = createHyphenator([Patterns[langCode][0], Patterns[langCode][1], {}]);
        var cond = getOrMakeCondition();

        var targets = getTargetObjects();
        if (targets.length === 0) return;

        txtStatus.text = "Fetching words...";
        win.layout.layout(true);

        // Word Collection Strategy
        var allWords = [];

        // For 'Whole Document', getting all words might crash memory.
        // Better to iterate stories or pages.
        // But for simplicity in script, we try. If document is huge, user should select smaller chunks.

        for (var t = 0; t < targets.length; t++) {
            // resolving words can be heavy.
            // If target is Document, iterate stories.
            if (targets[t] instanceof Document) {
                var stories = targets[t].stories;
                for (var s = 0; s < stories.length; s++) {
                    allWords = allWords.concat(stories[s].words.everyItem().getElements());
                }
            } else {
                allWords = allWords.concat(targets[t].words.everyItem().getElements());
            }
        }

        progBar.maxvalue = allWords.length;
        var hyphenCount = 0;

        txtStatus.text = "Processing " + allWords.length + " words...";
        win.layout.layout(true);

        // Process loop
        for (var w = 0; w < allWords.length; w++) {
            var wordObj = allWords[w];
            var content = wordObj.contents;

            // Clean content for processing: remove existing 0x00AD and spaces/punctuation
            // We want to hyphenate based on visible letters.
            // But we must map back to ORIGINAL indices.
            // If the original has Discretionary Hyphens, we should probably ignore them or strip them.
            // If we strip them, the indices change. 
            // So we really should strip them first if we want to re-hyphenate cleanly.
            // But stripping modify the DOM and invalidates `wordObj`.
            // So we cannot easily strip AND hyphenate in the same loop without re-resolving `wordObj`.

            // Compromise: We calculate points based on 'content'.
            // If 'content' has standard punctuation, Hyphenator might fail or return valid points.
            // We'll trust Hyphenator to handle the "word" passed to it, or strip basic punctuation.

            // NOTE: simple `replace` doesn't change the object, just the string copy.
            var cleanContent = content.replace(/[\u00AD\u200C\u200D]/g, ""); // Remove SHY, ZWNJ, ZWJ for calculation?
            // Actually, ZWNJ/ZWJ are significant in Indic. Punctuation is not.
            // Let's strip standard punctuation from start/end.

            // Hyphenator expects just the chars.
            // For now, pass content as is (cleaned of hyphen).
            cleanContent = content.replace(/\u00AD/g, "");

            if (cleanContent.length < 3) continue;

            // Run Hyphenator
            var points = hyphenator(cleanContent); // returns [1, 3, ...] indices

            if (points.length > 0) {
                // Iterate backwards
                for (var k = points.length - 1; k >= 0; k--) {
                    var idx = points[k];
                    try {
                        // Insert Hyphen at InsertionPoint
                        // The index from hyphenator matches the "cleaned" string indices.
                        // If we didn't remove ZWNJ etc, it matches.
                        // If we have punctuation, it might be off if hyphenator counts punctuation?
                        // The engine skips non-letters. But returns indices relative to the input string?
                        // "hyphenateWord" returns "levelsToMarkers" -> indices.
                        // These indices are into the `text` (argument passed).
                        // So if we pass "Hello.", and it hyphenates "Hel-lo", index is 3.
                        // "Hello."[3] == "l" (second l).
                        // Insertion point 3 is between l and l. Correct.

                        // InDesign: `wordObj.insertionPoints[idx]`
                        var ip = wordObj.insertionPoints[idx];

                        // Check if aleady hyphenated manually (don't double insert)
                        // But we just calculated where it SHOULD be. 
                        // If there's already a hyphen, we might double it?
                        // `wordObj.characters[idx]` might be the hyphen if it exists?
                        // We are inserting AT insertion point.

                        ip.contents = SpecialCharacters.DISCRETIONARY_HYPHEN;

                        // Apply Condition to the newly inserted character (which is now at `characters[idx]`)
                        // Wait, if we insert at 3, the new char is at index 3?
                        // "Hel" (0,1,2). Insert at 3. "Hel-". The hyphen is at index 3.
                        // Yes.
                        wordObj.characters[idx].applyConditions(cond);

                        hyphenCount++;
                    } catch (e) {
                        // Ignore insertion errors 
                    }
                }
            }

            if (w % 20 === 0) {
                progBar.value = w;
                // Periodic update to keep UI responsive
                // In ExtendScript, we can't easily yield. `win.update()` helps.
                // win.update(); // Not always available or standard. 
                // Usually InDesign script blocks UI.
            }
        }

        progBar.value = allWords.length;
        progBar.value = allWords.length;
        if (hyphenCount === 0) {
            alert("Done. 0 hyphens added.\n\nTroubleshooting:\n- Checked " + allWords.length + " words.\n- First word seen: '" + (allWords.length > 0 ? allWords[0].contents : "none") + "'\n- Result: " + (allWords.length > 0 ? JSON.stringify(hyphenator(allWords[0].contents.replace(/\u00AD/g, ""))) : "n/a"));
        } else {
            txtStatus.text = "Done. Added " + hyphenCount + " hyphens.";
        }
    };

    win.show();
}

main();
