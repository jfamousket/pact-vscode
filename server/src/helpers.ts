import NamedRegexp from "named-js-regexp";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver/node";
import { exec } from "child_process";

function mapStringToSeverity(str: string) {
  switch (str) {
    case "Trace":
      return DiagnosticSeverity.Information;
    case "Warning":
      return DiagnosticSeverity.Warning;
    default:
      return DiagnosticSeverity.Error;
  }
}

export function parse(
  data: string,
  regex: string,
  givenOptions: { flags?: string; filePath?: string } = {}
): Diagnostic[] {
  if (typeof data !== "string") {
    throw new Error("Invalid or no `data` provided");
  } else if (typeof regex !== "string") {
    throw new Error("Invalid or no `regex` provided");
  } else if (typeof givenOptions !== "object") {
    throw new Error("Invalid or no `options` provided");
  }

  const defaultOptions: Object = { flags: "" };
  const options = Object.assign(defaultOptions, givenOptions);
  if (options.flags?.indexOf("g") === -1) {
    options.flags += "g";
  }

  const messages: Diagnostic[] = [];
  const compiledRegexp = NamedRegexp(regex, options.flags);
  let rawMatch = compiledRegexp.exec(data);

  while (rawMatch !== null) {
    const match = rawMatch.groups();
    if (match === null) continue;
    const type = match.type;
    const message = match.message;
    const file = match.file || options.filePath || null;

    const lineStart = Number(match.lineStart || match.line || 0);
    const colStart = Number(match.colStart || match.col || 0);
    const lineEnd = Number(match.lineEnd || match.line || 0);
    const colEnd = Number(match.colEnd || match.col || 0);

    messages.push({
      message,
      severity: mapStringToSeverity(type),
      range: {
        end: {
          line: lineEnd > 0 ? lineEnd - 1 : 0,
          character: colEnd > 0 ? colEnd - 1 : 0,
        },
        start: {
          line: lineStart > 0 ? lineStart - 1 : 0,
          character: colStart > 0 ? colStart - 1 : 0,
        },
      },
    });

    rawMatch = compiledRegexp.exec(data);
  }

  return messages;
}

export function ordSev(e: Diagnostic) {
  if (e.severity === DiagnosticSeverity.Warning) {
    return 1;
  } else if (e.severity === DiagnosticSeverity.Information) {
    return 2;
  } else {
    return 0;
  }
}

export function cmpSev(e: Diagnostic, f: Diagnostic) {
  var es, fs;
  es = ordSev(e);
  fs = ordSev(f);
  if (es < fs) {
    return -1;
  } else if (es > fs) {
    return 1;
  } else {
    return 0;
  }
}

export function parseErrors(stderr: string, regex: string) {
  const errors: Array<Diagnostic> = [];
  for (let message of parse(stderr, regex)) {
    errors.push(message);
  }
  return ([] as Array<Diagnostic>).concat([], errors).sort(cmpSev);
}

const processMap: Map<string, Function> = new Map();

export const execShell = (cmd: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(cmd, (_, stdout, stderr) => {
      return resolve({ stderr, stdout });
    });
  });
