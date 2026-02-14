# Indic Hyphenator for Adobe InDesign
**User Guide**

## Overview
The **Indic Hyphenator** is a script for Adobe InDesign that automatically inserts discretionary hyphens into text for South Indian languages. This improves text layout and line breaking.

**Supported Languages:**
- Tamil
- Malayalam
- Telugu
- Kannada

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
- **Document:** Make sure nothing is selected to process the entire active document.

### 2. Run the Script
- Double-click `IndicHyphenator` in the Scripts panel.
- A dialog box will appear.

### 3. Choose Options
- **Scope:** Verify the scope (Selection, Story, or Document).
- **Language:** Select the language of your text from the dropdown menu.

### 4. Hyphenate
- Click the **Hyphenate** button.
- A progress bar will show the status.
- When finished, a message will tell you how many hyphens were added.

## Features & Tips

### Removing Hyphens
If you want to remove the hyphens added by this script (for example, to re-hyphenate after editing text):
1.  Run the script again.
2.  Click the **Remove Hyphens** button.
3.  **Note:** This is "smart removal". It only removes hyphens that *this script* added (tagged with the `IndicHyphenator` condition). Any manual hyphens you added yourself will safely remain.

### Editing Text
Discretionary hyphens are invisible characters (unless "Show Hidden Characters" is on). If you edit text, the hyphens might end up in the wrong place or be missing.
- **Recommendation:** After making significant edits, select the text, run the script, click **Remove Hyphens**, and then click **Hyphenate** again to refresh the hyphenation.

### "0 Hyphens Added"?
If the script says "0 hyphens added":
- **Encoding Issue:** This might happen if the script file was saved with an incorrect encoding, corrupting the special "invisible" characters used in Indic languages. The latest version of the script uses specific code to prevent this, so please ensure you are using the latest version.
- **Language Selection:** Ensure the correct language is selected in the dialog.
- **Short Words:** The algorithm avoids breaking very short words.
