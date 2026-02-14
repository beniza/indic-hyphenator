# Indic Hyphenator for Adobe InDesign
**User Guide (Version 2.0)**

## Overview
The **Indic Hyphenator** is a script for Adobe InDesign that automatically inserts discretionary hyphens into text for South Indian languages. This improves text layout and prevents awkward line breaks.

**Supported Languages:**
- Tamil
- Malayalam
- Telugu
- Kannada

> [!NOTE]
> **Algorithm:** The script uses a hybrid approach:
> 1. **Franklin M. Liang's algorithm** generates candidate hyphenation points.
> 2. **Den Em's syllable logic** verifies and filters these points to ensure linguistically correct breaks.

> [!NOTE]
> **Verification Status:** While the tool supports Tamil, Telugu, and Kannada, only **Malayalam** has been verified by a native speaker. We invite the community to help verify and improve the patterns for the other languages.

### New in Version 2.2
- **Enhanced Malayalam Support:** The script now treats **Chillu characters** (ൺ, ൻ, ർ, ൽ, ൾ, ൿ) as full syllable units. This results in more natural break points (e.g., `അർ-പ്പ` instead of `അർപ്പ-`).

## Installation

1.  **Download the Script:**
    Save the `IndicHyphenator.jsx` file to your computer.

2.  **Open InDesign Scripts Panel:**
    - Launch Adobe InDesign.
    - Go to `Window` > `Utilities` > `Scripts`.

3.  **Locate the User Scripts Folder:**
    - In the Scripts panel, find the folder named `User`.
    - Right-click (or Control-click on Mac) the `User` folder.
    - Select **Reveal in Explorer** (Windows) or **Reveal in Finder** (Mac).

4.  **Install:**
    - Copy the `IndicHyphenator.jsx` file into the folder that opened.
    - Return to InDesign. The script should now appear in the list under the User folder.

## How to Use

### 1. Select Text
You can run the script on different scopes:
- **Selection:** Select a text frame, a paragraph, or a range of text.
- **Story:** Place your cursor anywhere in a text frame to process user the entire story (all linked text frames).
- **Document:** Leave the selection empty (or select the document option in the script) to process the entire active document.

### 2. Run the Script
- Double-click `IndicHyphenator` in the Scripts panel.
- A dialog box will appear.

### 3. Choose Settings
- **Scope:** Verify the scope (Selection, Story, or Document).
- **Language:** Select the language of your text from the dropdown menu.

**Advanced Settings:**
- **Min Word Length:** The minimum number of characters a word must have to be hyphenated (default: 3).
- **Min Before:** Minimum characters to keep at the start of the word before a hyphen (default: 2).
- **Min After:** Minimum characters to keep at the end of the word after a hyphen (default: 2).
- **Break Character:** Choose between "Zero Width Space (Invisible)" or "Soft Hyphen (Visible -)". 
  - *Zero Width Space* (default) allows the word to break without showing a hyphen.
  - *Soft Hyphen* shows a hyphen when the word breaks.
- **Preview Mode (use '-'):** Inserts a visible `-` hyphen. Useful if you want to see potential break points clearly without using the "Show Hidden Characters" option.
- **Prevent Orphan Word:** Adds a non-breaking space between the last two words of every paragraph.
- **Ignore Last Word:** Skips hyphenation for the very last word of a paragraph.

### 4. Hyphenate
- Click the **Hyphenate** button.
- A progress bar will show the status.
- When finished, a message will tell you how many hyphens were added.

### 5. Review Output
Discretionary hyphens are invisible unless you show hidden characters.

**Examples of Hyphenation:**

| Language | Example Output |
| :--- | :--- |
| **Malayalam** | `അർ-പ്പ-ണ-മ-നോ-ഭാ-വ-ത്താ-ലുള്ള` |
| **Tamil** | `திருச்-சி-ராப்-பள்ளி` |
| **Telugu** | `ప్ర-పం-చీ-క-రణ` |
| **Kannada** | `ಬೆಂಗ-ಳೂರು` |

> *Note on Settings:* The "Min Before" and "Min After" settings count **visual syllable units**. For Malayalam, a Chillu character counts as its own unit, so a break like `അർ-` is allowed even if "Min Before" is set to 2 (because `അ` + `ർ` = 2 units).


## Features & Tips

### Removing Hyphens
To remove hyphens added by this script:
1.  Run the script.
2.  Click the **Remove Hyphens** button.
   - This removes Discretionary Hyphens, Preview `#` marks, and Non-breaking spaces added by the script.
   - **Note:** This is "smart removal". It only removes hyphens that *this script* added (tagged with the `IndicHyphenator` condition). Any manual hyphens you added yourself will safely remain.

### Editing Text
Discretionary hyphens are invisible characters (unless "Show Hidden Characters" is on). If you edit text, the hyphens might end up in the wrong place or be missing.
- **Recommendation:** After making significant edits, select the text, run the script, click **Remove Hyphens**, and then click **Hyphenate** again to refresh the hyphenation.

### Troubleshooting
If the script says "0 hyphens added":
- **Language Selection:** Ensure the correct language is selected in the dialog.
- **Short Words:** The algorithm avoids breaking very short words. Try lowering the "Min Word Length" setting.
- **Check Text:** Ensure the text is actual text and not outlined/vector paths.
