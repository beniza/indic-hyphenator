# Indic Hyphenator for Adobe InDesign

A scripted solution for adding discretionary hyphens to South Indian languages in Adobe InDesign.

## Features

- **Languages Supported:** Tamil, Malayalam, Telugu, Kannada.
- **Algorithm:** Uses a **hybrid approach**:
    - **Franklin M. Liang's algorithm** for generating candidate hyphenation points.
    - **Den Em's syllable-based logic** for verifying valid break points and enforcing syllable constraints.
- **Scope Control:** Works on current selection, parent story, or the entire document.
- **Smart Logic:**
    - Configurable minimum word length.
    - Configurable minimum characters before/after hyphen.
    - Prevents breaking combining characters.
    - "Fix Last Line" to prevent orphans.
    - **Enhanced Malayalam Support:** Chillu characters (ൺ, ൻ, ർ, etc.) are treated as full letters for more natural break points.
- **Non-Destructive:** Adds hyphens as "Discretionary Hyphens" (or visible `-` for preview) tagged with a specific condition for easy removal.

## Installation

1. Download `IndicHyphenator.jsx`.
2. Open Adobe InDesign.
3. Go to **Window > Utilities > Scripts**.
4. Right-click the **User** folder and select **Reveal in Explorer/Finder**.
5. Copy `IndicHyphenator.jsx` AND the `lib` folder into that folder.

For detailed usage instructions, please see the [User Guide](UserGuide.md).

## Usage

1. Open a document in InDesign.
2. Double-click **IndicHyphenator** in the Scripts panel.
3. Select your language and scope.
4. Click **Hyphenate**.

To remove hyphens added by this script, simply run the script again and click **Remove Hyphens**.

## Development

### Files

- `IndicHyphenator.jsx`: The main script execution file for Adobe InDesign.
- `test_logic.js`: A Node.js test file to simulate the hyphenation logic without InDesign.
- `UserGuide.md`: End-user documentation.

### Testing Logic

You can test the core hyphenation logic using Node.js:

```bash
node test_logic.js
```

This runs a simulation of the V2 algorithm against sample words to verify split points and constraints.

## Contributing

**We need your help!**

While the scripts for Tamil, Telugu, and Kannada are included, they have **not yet been verified** by native speakers.

If you are a native speaker of these languages, please:
1. Try the script on some sample text.
2. Report any bad break points or missed opportunities.
3. Submit a Pull Request with improved patterns or logic.

## License

MIT (See script header for details)
