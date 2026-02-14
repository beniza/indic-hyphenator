// #target "indesign"

/**
 * Indic Hyphenator for Adobe InDesign
 * Adds discretionary hyphens for Tamil, Malayalam, Telugu, and Kannada.
 * 
 * Hyphenation patterns based on Franklin M. Liang's algorithm.
 * Syllable detection ported from MarkDravidianHyphenatedWords.py by Dan M.
 * Patterns from: https://github.com/ytiurin/hyphen
 */

// ============================================================================================
// INCLUDES
// ============================================================================================

// @include "lib/Polyfills.jsx"
// @include "lib/Hyphenator.jsx"
// @include "lib/patterns/ta.jsx"
// @include "lib/patterns/ml.jsx"
// @include "lib/patterns/te.jsx"
// @include "lib/patterns/kn.jsx"

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
        var rules = Patterns[langCode].rules || {};
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
                processWord(words[w], hyphenator, cond, minWordLen, minBefore, minAfter, usePreview, rules);
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

        function processWord(wordObj, hyphenator, cond, minLen, minB, minA, preview, rules) {
            var content = wordObj.contents;
            // Robust cleanup: remove soft hyphens, ZWJ/ZWNJ, ZWSP
            // Also trim leading punctuation for the purpose of "cleanContent" length check?
            // Actually, keep punctuation but ensuring we don't break *at* it is handled by the index check below.
            var cleanContent = content.replace(/[\u00AD\u200C\u200D\u200B]/g, "").replace(/\u00AD/g, "");

            // 1. Blacklist Check
            if (rules && rules.blacklist && rules.blacklist.length > 0) {
                // Determine if we need exact match or contains
                // Usually exact word match.
                for (var b = 0; b < rules.blacklist.length; b++) {
                    if (cleanContent === rules.blacklist[b]) return;
                }
            }

            // Syllable-based length check
            var totalSyll = countSyllables(cleanContent);
            if (totalSyll < minLen) return;

            var points = hyphenator(cleanContent);

            for (var k = points.length - 1; k >= 0; k--) {
                var idx = points[k];
                if (isCombiningMark(cleanContent[idx])) continue;

                // Syllable-based min before/after checks
                var leftPart = cleanContent.substring(0, idx);
                var rightPart = cleanContent.substring(idx);
                var syllBefore = countSyllables(leftPart);
                var syllAfter = countSyllables(rightPart);
                if (syllBefore < minB) continue;
                if (syllAfter < minA) continue;

                // 2. Do Not Break Before Check (e.g. Chillu)
                if (rules && rules.doNotBreakBefore) {
                    if (rules.doNotBreakBefore.indexOf(cleanContent[idx]) !== -1) continue;
                }

                // 3. Bad Fragment Check (End of Line)
                if (rules && rules.badFragments) {
                    var fragment = cleanContent.substring(0, idx);
                    var blocked = false;
                    for (var bf = 0; bf < rules.badFragments.length; bf++) {
                        if (fragment === rules.badFragments[bf]) {
                            blocked = true;
                            break;
                        }
                    }
                    if (blocked) continue;
                }

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
