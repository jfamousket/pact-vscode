"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const node_1 = require("vscode-languageserver/node");
const helpers_1 = require("./helpers");
const regexAll = "(?<file>[^:\\n]*):(?<line>\\d+):(?<col>\\d+):((?<type>[^:]+):)?(?<message>(\\s+.*\\n)+)";
let connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
let documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: false,
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log("Workspace folder change event received.");
        });
    }
});
const defaultSettings = {
    pactExcerptSize: 80,
    pactPath: "pact",
    doCoverage: false,
    doTrace: false,
};
let globalSettings = defaultSettings;
// Cache the settings of all open documents
let documentSettings = new Map();
connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: "language-pact",
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
// documents.onDidChangeContent((change) => {
//   validateTextDocument(change.document);
// });
documents.onDidSave((change) => validateTextDocument(change.document));
async function validateTextDocument(textDocument) {
    var _a;
    try {
        // In this simple example we get the settings for every validate run.
        let settings = await getDocumentSettings(textDocument.uri);
        const filePath = textDocument.uri;
        const command = (_a = settings.pactPath) !== null && _a !== void 0 ? _a : "pact";
        let parameters = [command, "-r", filePath.slice("file://".length)];
        if (settings.doTrace)
            parameters = parameters.concat("-t");
        if (settings.doCoverage)
            parameters = parameters.concat("-c");
        const output = await (0, helpers_1.execShell)(parameters.join(" "));
        const diagnostics = (0, helpers_1.parseErrors)(output.stderr, regexAll);
        // Send the computed diagnostics to VS Code.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }
    catch (error) {
        if (typeof error === "string" && error.indexOf("ENOENT") !== -1) {
            connection.sendNotification(error + "[pact tool not installed?]");
        }
    }
}
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map