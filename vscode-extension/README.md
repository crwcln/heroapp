# Hero Site Config Editor

A small VS Code extension for editing `js/00-site-config.js` from a settings form.

## Open the settings sidebar

1. Open this repository in VS Code.
2. Press **F5** to launch the Extension Development Host.
3. In the new window, click the **Hero** icon in the left Activity Bar.
4. Edit the settings and feature switches in **Site Settings**, then click **Save site settings**.

The sidebar finds `js/00-site-config.js` in the open project automatically. If it cannot find one, use **Choose config**. It changes only known setting values and keeps the rest of the file, including comments and formatting, intact. The Command Palette command **Hero: Edit Site Configuration** opens the same sidebar.

## Package for installation

Install `@vscode/vsce` and run `vsce package` from this directory, then install the generated VSIX file with **Extensions: Install from VSIX...**. No dependencies are needed to run the extension in development mode.
