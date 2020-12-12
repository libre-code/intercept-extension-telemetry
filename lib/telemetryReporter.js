/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
process.env['APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL'] = true;
var path = require("path");
var vscode = require("vscode");
var channel = vscode.window.createOutputChannel('Telemetry interception');
function intercept(name) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return channel.appendLine(name + "(" + JSON.stringify(args).slice(1, -1) + ")");
    };
}
var TelemetryReporter = /** @class */ (function () {
    // tslint:disable-next-line
    function TelemetryReporter(extensionId, extensionVersion, key, firstParty) {
        var _this = this;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.userOptIn = false;
        this.createAppInsightsClient = intercept('createAppInsightsClient');
        this.dispose = intercept('dispose');
        this.sendTelemetryErrorEvent = intercept('sendTelemetryErrorEvent');
        this.sendTelemetryEvent = intercept('sendTelemetryEvent');
        this.sendTelemetryException = intercept('sendTelemetryException');
        var logFilePath = process.env['VSCODE_LOGS'] || '';
        if (logFilePath && extensionId && process.env['VSCODE_LOG_LEVEL'] === 'trace') {
            logFilePath = path.join(logFilePath, extensionId + ".txt");
        }
        this.updateUserOptIn(key);
        this.configListener = vscode.workspace.onDidChangeConfiguration(function () { return _this.updateUserOptIn(key); });
    }
    TelemetryReporter.prototype.updateUserOptIn = function (key) {
        var config = vscode.workspace.getConfiguration(TelemetryReporter.TELEMETRY_CONFIG_ID);
        if (this.userOptIn !== config.get(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true)) {
            this.userOptIn = config.get(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true);
            if (this.userOptIn) {
                this.createAppInsightsClient(key);
            }
            else {
                this.dispose();
            }
        }
    };
    TelemetryReporter.TELEMETRY_CONFIG_ID = 'telemetry';
    TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';
    return TelemetryReporter;
}());
exports.default = TelemetryReporter;
//# sourceMappingURL=telemetryReporter.js.map