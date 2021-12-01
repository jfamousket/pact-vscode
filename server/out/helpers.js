"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execShell = exports.parseErrors = exports.cmpSev = exports.ordSev = exports.parse = void 0;
const named_js_regexp_1 = __importDefault(require("named-js-regexp"));
const node_1 = require("vscode-languageserver/node");
const child_process_1 = require("child_process");
function mapStringToSeverity(str) {
    switch (str) {
        case "Trace":
            return node_1.DiagnosticSeverity.Information;
        case "Warning":
            return node_1.DiagnosticSeverity.Warning;
        default:
            return node_1.DiagnosticSeverity.Error;
    }
}
function parse(data, regex, givenOptions = {}) {
    var _a;
    if (typeof data !== "string") {
        throw new Error("Invalid or no `data` provided");
    }
    else if (typeof regex !== "string") {
        throw new Error("Invalid or no `regex` provided");
    }
    else if (typeof givenOptions !== "object") {
        throw new Error("Invalid or no `options` provided");
    }
    const defaultOptions = { flags: "" };
    const options = Object.assign(defaultOptions, givenOptions);
    if (((_a = options.flags) === null || _a === void 0 ? void 0 : _a.indexOf("g")) === -1) {
        options.flags += "g";
    }
    const messages = [];
    const compiledRegexp = (0, named_js_regexp_1.default)(regex, options.flags);
    let rawMatch = compiledRegexp.exec(data);
    while (rawMatch !== null) {
        const match = rawMatch.groups();
        if (match === null)
            continue;
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
exports.parse = parse;
function ordSev(e) {
    if (e.severity === node_1.DiagnosticSeverity.Warning) {
        return 1;
    }
    else if (e.severity === node_1.DiagnosticSeverity.Information) {
        return 2;
    }
    else {
        return 0;
    }
}
exports.ordSev = ordSev;
function cmpSev(e, f) {
    var es, fs;
    es = ordSev(e);
    fs = ordSev(f);
    if (es < fs) {
        return -1;
    }
    else if (es > fs) {
        return 1;
    }
    else {
        return 0;
    }
}
exports.cmpSev = cmpSev;
function parseErrors(stderr, regex) {
    const errors = [];
    for (let message of parse(stderr, regex)) {
        errors.push(message);
    }
    return [].concat([], errors).sort(cmpSev);
}
exports.parseErrors = parseErrors;
const processMap = new Map();
const execShell = (cmd) => new Promise((resolve, reject) => {
    (0, child_process_1.exec)(cmd, (_, stdout, stderr) => {
        return resolve({ stderr, stdout });
    });
});
exports.execShell = execShell;
//# sourceMappingURL=helpers.js.map