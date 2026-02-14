// #target "indesign"

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
            return [];
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

function isCombiningMark(char) {
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
    var win = new Window("dialog", "Indic Hyphenator V2");
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
    }

    // Panel: Language
    var pLang = win.add("panel", undefined, "Language");
    pLang.alignChildren = "left";
    var dwLang = pLang.add("dropdownlist", undefined, ["Tamil", "Malayalam", "Telugu", "Kannada"]);
    dwLang.selection = 0;

    // Panel: Settings
    var pSettings = win.add("panel", undefined, "Settings");
    pSettings.alignChildren = "left";

    var gMinWord = pSettings.add("group");
    gMinWord.add("statictext", undefined, "Min Word Length:");
    var etMinWord = gMinWord.add("edittext", undefined, "3");
    etMinWord.characters = 3;

    var gMinChars = pSettings.add("group");
    gMinChars.add("statictext", undefined, "Min Before:");
    var etMinBefore = gMinChars.add("edittext", undefined, "2");
    etMinBefore.characters = 3;
    gMinChars.add("statictext", undefined, "Min After:");
    var etMinAfter = gMinChars.add("edittext", undefined, "2");
    etMinAfter.characters = 3;

    var cbPreview = pSettings.add("checkbox", undefined, "Preview Mode (use '-')");
    var cbFixLastLine = pSettings.add("checkbox", undefined, "Prevent orphan word (Fix Last Line)");
    var cbIgnoreLastWord = pSettings.add("checkbox", undefined, "Ignore Last Word of Paragraph");
    var cbIgnoreLastWord = pSettings.add("checkbox", undefined, "Ignore Last Word of Paragraph");
    cbIgnoreLastWord.value = true; // Default

    var gBreak = pSettings.add("group");
    gBreak.add("statictext", undefined, "Break Character:");
    var dwBreak = gBreak.add("dropdownlist", undefined, ["Zero Width Space (Invisible)", "Soft Hyphen (Visible -)"]);
    dwBreak.selection = 0; // Default to Invisible

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
        if (rbSelection.value) {
            for (var i = 0; i < app.selection.length; i++) {
                if (app.selection[i].hasOwnProperty("texts")) {
                    targets.push(app.selection[i].texts[0]);
                } else if (app.selection[i] instanceof TextFrame) {
                    targets.push(app.selection[i].texts[0]);
                } else if (app.selection[i] instanceof Text) {
                    targets.push(app.selection[i]);
                }
            }
        } else if (rbStory.value) {
            if (app.selection.length > 0 && app.selection[0].parentStory) {
                targets.push(app.selection[0].parentStory);
            }
        } else {
            // Document
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
        win.layout.layout(true);

        app.findChangeTextOptions.includeFootnotes = true;
        app.findChangeTextOptions.includeHiddenLayers = false;
        app.findChangeTextOptions.includeLockedLayersForFind = false;
        app.findChangeTextOptions.includeLockedStoriesForFind = false;
        app.findChangeTextOptions.includeMasterPages = false;

        app.findTextPreferences = NothingEnum.nothing;
        app.changeTextPreferences = NothingEnum.nothing;

        var counter = 0;

        // 1. Remove standard Discretionary Hyphens
        app.findTextPreferences.findWhat = "^-";
        counter += removeFound(targets, CONDITION_NAME);

        // 2. Remove '-' (if preview mode was used)
        app.findTextPreferences.findWhat = "-";
        counter += removeFound(targets, CONDITION_NAME);

        // 3. Remove Zero Width Spaces (invisible breaks)
        app.findTextPreferences.findWhat = "\u200B"; // Zero Width Space
        counter += removeFound(targets, CONDITION_NAME);

        // 4. Remove Non-breaking spaces (if we inserted them)
        app.findTextPreferences.findWhat = "^S"; // Nonbreaking space
        counter += removeFound(targets, CONDITION_NAME);

        app.findTextPreferences = NothingEnum.nothing;
        txtStatus.text = "Removed " + counter + " items.";
    };

    function removeFound(targets, condName) {
        var count = 0;
        for (var i = 0; i < targets.length; i++) {
            var found = targets[i].findText();
            for (var j = found.length - 1; j >= 0; j--) {
                var conds = found[j].appliedConditions;
                var isTagged = false;
                if (conds && conds.length) {
                    for (var c = 0; c < conds.length; c++) {
                        if (conds[c].name === condName) {
                            isTagged = true;
                            break;
                        }
                    }
                }
                if (isTagged) {
                    if (found[j].contents === SpecialCharacters.NONBREAKING_SPACE) {
                        found[j].contents = " "; // Replace with normal space
                    } else {
                        found[j].remove(); // Remove hyphen/#
                    }
                    count++;
                }
            }
        }
        return count;
    }

    // RUN logic
    btnRun.onClick = function () {
        var langCode = ["ta", "ml", "te", "kn"][dwLang.selection.index];
        var hyphenator = createHyphenator([Patterns[langCode][0], Patterns[langCode][1], {}]);
        var cond = getOrMakeCondition();

        var minWordLen = parseInt(etMinWord.text, 10) || 3;
        var minBefore = parseInt(etMinBefore.text, 10) || 2;
        var minAfter = parseInt(etMinAfter.text, 10) || 2;
        var usePreview = cbPreview.value;
        var fixLastLine = cbFixLastLine.value;
        var ignoreLastWord = cbIgnoreLastWord.value;

        var targets = getTargetObjects();
        if (targets.length === 0) return;

        txtStatus.text = "Scanning text...";
        win.layout.layout(true);

        var hyphenCount = 0;

        var allParagraphs = [];
        for (var t = 0; t < targets.length; t++) {
            if (targets[t] instanceof Document) {
                var stories = targets[t].stories;
                for (var s = 0; s < stories.length; s++) {
                    allParagraphs = allParagraphs.concat(stories[s].paragraphs.everyItem().getElements());
                }
            } else {
                allParagraphs = allParagraphs.concat(targets[t].paragraphs.everyItem().getElements());
            }
        }

        progBar.maxvalue = allParagraphs.length;

        for (var p = 0; p < allParagraphs.length; p++) {
            var para = allParagraphs[p];
            var words = para.words.everyItem().getElements();

            if (words.length === 0) continue;

            // FIX LAST LINE: Non-breaking space
            if (fixLastLine && words.length >= 2) {
                try {
                    var penWord = words[words.length - 2];
                    var followChar = penWord.characters.item(-1).parent.characters.item(penWord.characters.item(-1).index + 1);
                    if (followChar.isValid && followChar.contents === " ") {
                        followChar.contents = SpecialCharacters.NONBREAKING_SPACE;
                        followChar.applyConditions(cond);
                    }
                } catch (e) { }
            }

            var limit = words.length;
            if (ignoreLastWord) limit--;

            for (var w = 0; w < limit; w++) {
                processWord(words[w], hyphenator, cond, minWordLen, minBefore, minAfter, usePreview);
            }

            if (p % 10 === 0) {
                progBar.value = p;
            }
        }

        progBar.value = allParagraphs.length;
        if (hyphenCount === 0) {
            txtStatus.text = "Done. 0 hyphens added.";
        } else {
            txtStatus.text = "Done. Added " + hyphenCount + " hyphens.";
        }

        function processWord(wordObj, hyphenator, cond, minLen, minB, minA, preview) {
            var content = wordObj.contents;
            var cleanContent = content.replace(/[\u00AD\u200C\u200D\u200B]/g, "").replace(/\u00AD/g, "");

            if (cleanContent.length < minLen) return;

            var points = hyphenator(cleanContent);

            for (var k = points.length - 1; k >= 0; k--) {
                var idx = points[k];
                if (idx < minB) continue;
                if ((cleanContent.length - idx) < minA) continue;
                if (isCombiningMark(cleanContent[idx])) continue;

                try {
                    var ip = wordObj.insertionPoints[idx];
                    if (preview) {
                        ip.contents = "-";
                    } else if (dwBreak.selection.index === 0) {
                        // Zero Width Space (Invisible)
                        ip.contents = "\u200B";
                    } else {
                        // Soft Hyphen (Visible)
                        ip.contents = SpecialCharacters.DISCRETIONARY_HYPHEN;
                    }
                    wordObj.characters[idx].applyConditions(cond);
                    hyphenCount++;
                } catch (e) { }
            }
        }
    };

    win.show();
}

main();
