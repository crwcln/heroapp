const vscode = require('vscode');
const path = require('path');

const CONFIG_PATH = 'js/00-site-config.js';
const CORE_FIELDS = ['id', 'name', 'version', 'tagline', 'launchAt', 'intro', 'introVideo'];

function parseLiteral(source, property, scope = source) {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = scope.match(new RegExp(`(^[ \\t]*${escaped}[ \\t]*:[ \\t]*)(('(?:\\\\.|[^'\\\\])*'|"(?:\\\\.|[^"\\\\])*"|-?\\d+(?:\\.\\d+)?|true|false|null))([ \\t]*,?)`, 'm'));
    if (!match) throw new Error(`Could not find a simple "${property}" setting in ${CONFIG_PATH}.`);
    const literal = match[2];
    if (literal[0] === "'") {
        return literal.slice(1, -1).replace(/\\(['\\rn])/g, (_, escaped) => ({
            "'": "'", '\\': '\\', r: '\r', n: '\n',
        }[escaped]));
    }
    if (literal[0] === '"') {
        try { return JSON.parse(literal); }
        catch { throw new Error(`The "${property}" setting is not valid JSON-style text.`); }
    }
    if (literal === 'true') return true;
    if (literal === 'false') return false;
    if (literal === 'null') return null;
    return Number(literal);
}

function readSettings(source) {
    const settings = Object.fromEntries(CORE_FIELDS.map((field) => [field, parseLiteral(source, field)]));
    const featuresMatch = source.match(/(^[ \t]*features[ \t]*:[ \t]*\{)([\s\S]*?)(^[ \t]*\})/m);
    if (!featuresMatch) throw new Error(`Could not find the features object in ${CONFIG_PATH}.`);
    settings.features = {};
    const featurePattern = /^[ \t]*([A-Za-z_$][\w$]*)[ \t]*:[ \t]*(true|false)[ \t]*,?/gm;
    let match;
    while ((match = featurePattern.exec(featuresMatch[2]))) settings.features[match[1]] = match[2] === 'true';
    if (!Object.keys(settings.features).length) throw new Error(`Could not read feature flags in ${CONFIG_PATH}.`);
    return settings;
}

function encodeString(value) {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;
}

function setLiteral(source, property, value, scopeStart = 0, scopeEnd = source.length) {
    const scope = source.slice(scopeStart, scopeEnd);
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^[ \\t]*${escaped}[ \\t]*:[ \\t]*)(('(?:\\\\.|[^'\\\\])*'|"(?:\\\\.|[^"\\\\])*"|-?\\d+(?:\\.\\d+)?|true|false|null))([ \\t]*,?)`, 'm');
    const match = pattern.exec(scope);
    if (!match) throw new Error(`Could not update "${property}" in ${CONFIG_PATH}.`);
    const literal = typeof value === 'string' ? encodeString(value) : String(value);
    const updated = scope.slice(0, match.index) + match[1] + literal + match[4] + scope.slice(match.index + match[0].length);
    return source.slice(0, scopeStart) + updated + source.slice(scopeEnd);
}

function updateSettings(source, settings) {
    let updated = source;
    for (const field of CORE_FIELDS) {
        const value = settings[field];
        if (typeof value !== (field === 'intro' ? 'number' : 'string')) {
            throw new Error(`Invalid value for "${field}".`);
        }
        updated = setLiteral(updated, field, value);
    }
    const featuresMatch = updated.match(/(^[ \t]*features[ \t]*:[ \t]*\{)([\s\S]*?)(^[ \t]*\})/m);
    if (!featuresMatch) throw new Error(`Could not find the features object in ${CONFIG_PATH}.`);
    const blockStart = featuresMatch.index + featuresMatch[1].length;
    let block = featuresMatch[2];
    for (const [feature, enabled] of Object.entries(settings.features || {})) {
        if (typeof enabled !== 'boolean') throw new Error(`Invalid value for feature "${feature}".`);
        const escaped = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(^[ \\t]*${escaped}[ \\t]*:[ \\t]*)(true|false)([ \\t]*,?)`, 'm');
        const match = pattern.exec(block);
        if (!match) throw new Error(`Could not update feature "${feature}" in ${CONFIG_PATH}.`);
        block = block.slice(0, match.index) + match[1] + String(enabled) + match[3] + block.slice(match.index + match[0].length);
    }
    return updated.slice(0, blockStart) + block + updated.slice(blockStart + featuresMatch[2].length);
}

function validateSettings(settings, knownFeatures) {
    for (const field of ['id', 'name', 'version', 'tagline', 'launchAt']) {
        if (!settings[field].trim()) throw new Error(`"${field}" cannot be empty.`);
    }
    if (!/^[A-Za-z0-9_-]+$/.test(settings.id)) throw new Error('Site id may contain only letters, numbers, hyphens, and underscores.');
    if (!Number.isInteger(settings.intro) || settings.intro < 0) throw new Error('Intro replay number must be a whole number greater than or equal to 0.');
    if (settings.launchAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(settings.launchAt)) {
        throw new Error('Launch time must be in UTC ISO format, for example 2026-10-21T23:00:00Z.');
    }
    if (settings.launchAt && new Date(settings.launchAt).toISOString() !== settings.launchAt) {
        throw new Error('Launch time must be a real date and time in UTC.');
    }
    if (!settings.features || Object.keys(settings.features).length !== knownFeatures.length
        || knownFeatures.some((feature) => typeof settings.features[feature] !== 'boolean')) {
        throw new Error('Feature flags changed while the editor was open. Close it and open the form again.');
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
}

function nonce() {
    const bytes = require('crypto').randomBytes(16);
    return bytes.toString('base64');
}

function renderPanel(panel, settings, features) {
    const token = nonce();
    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${panel.webview.cspSource}; script-src 'nonce-${token}';">
  <title>Hero Site Configuration</title>
  <style>
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 13px var(--vscode-font-family); max-width: 760px; padding: 12px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; }
    form { display: grid; grid-template-columns: 1fr; gap: 12px; }
    label { display: grid; gap: 6px; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-dropdown-border)); padding: 7px 8px; }
    input:focus { outline: 1px solid var(--vscode-focusBorder); }
    .hint { font-weight: 400; color: var(--vscode-descriptionForeground); }
    fieldset { border: 1px solid var(--vscode-panel-border); display: grid; grid-template-columns: 1fr; gap: 10px; }
    legend { font-weight: 700; padding: 0 6px; }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 400; }
    .check input { width: auto; }
    footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 4px; }
    button { color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 0; padding: 7px 14px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    #status { width: 100%; color: var(--vscode-errorForeground); }
    .file-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 12px 0; }
    .file-row code { overflow-wrap: anywhere; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <h1>Hero Site Configuration</h1>
  <p>Edit the site settings here. Launch time uses UTC, for example <code>2026-10-21T23:00:00Z</code>.</p>
  <div class="file-row"><code>${escapeHtml(vscode.workspace.asRelativePath(settings.uri, false))}</code><button type="button" id="choose-file">Choose config</button></div>
  <form id="settings">
    ${[
        ['id', 'Site data id', 'Firestore namespace; changing it points the site at a different data set.'],
        ['name', 'Site name', ''],
        ['version', 'Site version', ''],
        ['tagline', 'Tagline', ''],
        ['launchAt', 'Launch time (UTC)', 'Example: 2026-10-21T23:00:00Z'],
        ['intro', 'Intro replay number', 'Increase this to replay the intro for everyone. Use 0 to disable replay tracking.'],
        ['introVideo', 'Intro video path', 'Optional path to an MP4 file.'],
    ].map(([key, title, hint]) => `<label>${title}${hint ? `<span class="hint">${hint}</span>` : ''}<input name="${key}" type="text" value="${escapeHtml(settings[key])}" spellcheck="false"></label>`).join('')}
    <fieldset><legend>Features</legend>
      ${features.map((feature) => `<label class="check"><input name="feature:${escapeHtml(feature)}" type="checkbox"${settings.features[feature] ? ' checked' : ''}>${escapeHtml(feature)}</label>`).join('')}
    </fieldset>
    <footer><span id="status" role="status"></span><button type="submit">Save site settings</button></footer>
  </form>
  <script nonce="${token}">
    const vscode = acquireVsCodeApi();
    document.getElementById('settings').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const settings = Object.fromEntries(['id', 'name', 'version', 'tagline', 'launchAt', 'intro', 'introVideo'].map((key) => [key, key === 'intro' ? Number(form.get(key)) : String(form.get(key) || '')]));
      settings.features = Object.fromEntries(${JSON.stringify(features)}.map((feature) => [feature, form.has('feature:' + feature)]));
      vscode.postMessage({ type: 'save', settings });
      document.getElementById('status').textContent = 'Saving…';
    });
    document.getElementById('choose-file').addEventListener('click', () => vscode.postMessage({ type: 'chooseFile' }));
    window.addEventListener('message', (event) => {
      document.getElementById('status').textContent = event.data.error || event.data.message || '';
    });
  </script>
</body>
</html>`;
}

async function findConfigUri() {
    const files = [];
    for (const folder of vscode.workspace.workspaceFolders || []) {
        const matches = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, CONFIG_PATH), '**/node_modules/**', 20);
        files.push(...matches);
    }
    const uniqueFiles = [...new Map(files.map((file) => [file.toString(), file])).values()];
    if (uniqueFiles.length === 1) return uniqueFiles[0];
    if (!uniqueFiles.length) return undefined;
    const selected = await vscode.window.showQuickPick(uniqueFiles.map((file) => ({
        label: vscode.workspace.asRelativePath(file),
        uri: file,
    })), { placeHolder: 'Choose the site configuration to edit' });
    return selected && selected.uri;
}

function renderMessage(webview, message, showChoose = false) {
    const token = nonce();
    webview.html = `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${token}';"></head><body style="font:13px var(--vscode-font-family);padding:16px;color:var(--vscode-foreground)"><p>${escapeHtml(message)}</p>${showChoose ? `<button id="choose" style="padding:8px">Choose config</button><script nonce="${token}">document.getElementById('choose').addEventListener('click', () => acquireVsCodeApi().postMessage({ type: 'chooseFile' }));</script>` : ''}</body></html>`;
}

class SiteConfigViewProvider {
    constructor() {
        this.view = undefined;
        this.uri = undefined;
        this.features = [];
    }

    async resolveWebviewView(view) {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.onDidReceiveMessage((message) => this.handleMessage(message));
        renderMessage(view.webview, 'Loading Hero site settings…');
        await this.loadConfig();
    }

    async loadConfig() {
        if (!this.view) return;
        try {
            this.uri = await findConfigUri();
            if (!this.uri) {
                renderMessage(this.view.webview, `Open a Hero project folder or locate ${CONFIG_PATH}.`, true);
                return;
            }
            const document = await vscode.workspace.openTextDocument(this.uri);
            const settings = readSettings(document.getText());
            settings.uri = this.uri;
            this.features = Object.keys(settings.features);
            renderPanel(this.view, settings, this.features);
        } catch (error) {
            renderMessage(this.view.webview, error.message || 'Could not load the site configuration.');
            vscode.window.showErrorMessage(error.message || 'Could not load the site configuration.');
        }
    }

    async handleMessage(message) {
        if (!message) return;
        if (message.type === 'chooseFile') {
            const picked = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Open site config',
                title: `Locate ${CONFIG_PATH}`,
                filters: { 'JavaScript config': ['js'] },
            });
            if (!picked || !picked.length) return;
            if (path.basename(picked[0].fsPath) !== '00-site-config.js' || path.basename(path.dirname(picked[0].fsPath)) !== 'js') {
                vscode.window.showErrorMessage(`Choose the ${CONFIG_PATH} file.`);
                return;
            }
            this.uri = picked[0];
            await this.loadConfig();
            return;
        }
        if (message.type !== 'save' || !message.settings || !this.uri) return;
        try {
            validateSettings(message.settings, this.features);
            const document = await vscode.workspace.openTextDocument(this.uri);
            const currentSource = document.getText();
            const updated = updateSettings(currentSource, message.settings);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(this.uri, new vscode.Range(document.positionAt(0), document.positionAt(currentSource.length)), updated);
            if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code could not save the configuration.');
            if (!await document.save()) throw new Error('VS Code could not save the configuration.');
            this.view.webview.postMessage({ message: `Saved ${vscode.workspace.asRelativePath(this.uri, false)}.` });
            vscode.window.showInformationMessage('Hero site settings saved.');
        } catch (error) {
            this.view.webview.postMessage({ error: error.message || 'Could not save site settings.' });
        }
    }
}

function activate(context) {
    const provider = new SiteConfigViewProvider();
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('heroConfig.settings', provider));
    context.subscriptions.push(vscode.commands.registerCommand('heroSiteConfig.edit', () => vscode.commands.executeCommand('workbench.view.extension.heroConfig')));
}

function deactivate() {}

module.exports = { activate, deactivate };
