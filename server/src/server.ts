import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  DidChangeConfigurationNotification,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { execShell, parseErrors } from "./helpers";

const regexAll =
  "(?<file>[^:\\n]*):(?<line>\\d+):(?<col>\\d+):((?<type>[^:]+):)?(?<message>(\\s+.*\\n)+)";

let connection = createConnection(ProposedFeatures.all);

let documents = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

connection.onInitialize((params) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
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
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

interface Settings {
  pactPath: string;
  pactExcerptSize: number;
  doTrace: boolean;
  doCoverage: boolean;
}

const defaultSettings: Settings = {
  pactExcerptSize: 80,
  pactPath: "pact",
  doCoverage: false,
  doTrace: false,
};
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <Settings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  try {
    // In this simple example we get the settings for every validate run.
    let settings = await getDocumentSettings(textDocument.uri);
    const filePath = textDocument.uri;
    const command = settings.pactPath ?? "pact";
    let parameters = [command, "-r", filePath.slice("file://".length)];
    if (settings.doTrace) parameters = parameters.concat("-t");
    if (settings.doCoverage) parameters = parameters.concat("-c");
    const output = await execShell(parameters.join(" "));
    const diagnostics = parseErrors(output.stderr, regexAll);
    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (error) {
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
