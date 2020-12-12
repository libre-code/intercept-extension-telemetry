/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

(process.env['APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL'] as any) = true;

import * as path from 'path';
import * as vscode from 'vscode';

const channel = vscode.window.createOutputChannel('Telemetry interception');

function intercept(name: string): (...args: any) => any {
    return (...args: any) => channel.appendLine(`${name}(${JSON.stringify(args).slice(1, -1)})`);
}

export default class TelemetryReporter {
    private createAppInsightsClient: (key: string) => void;
    public dispose: () => Promise<any>;
    public sendTelemetryErrorEvent: (eventName: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }, errorProps?: string[]) => void;
    public sendTelemetryEvent: (eventName: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }) => void;
    public sendTelemetryException: (error: Error, properties?: { [key: string]: string }, measurements?: { [key: string]: number }) => void;

    private userOptIn: boolean = false;
    private readonly configListener: vscode.Disposable;

    private static TELEMETRY_CONFIG_ID = 'telemetry';
    private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';

    // tslint:disable-next-line
    constructor(private extensionId: string, private extensionVersion: string, key: string, firstParty?: boolean) {
        this.createAppInsightsClient = intercept('createAppInsightsClient');
        this.dispose = intercept('dispose');
        this.sendTelemetryErrorEvent = intercept('sendTelemetryErrorEvent');
        this.sendTelemetryEvent = intercept('sendTelemetryEvent');
        this.sendTelemetryException = intercept('sendTelemetryException');

        let logFilePath = process.env['VSCODE_LOGS'] || '';
        if (logFilePath && extensionId && process.env['VSCODE_LOG_LEVEL'] === 'trace') {
            logFilePath = path.join(logFilePath, `${extensionId}.txt`);
        }
        this.updateUserOptIn(key);
        this.configListener = vscode.workspace.onDidChangeConfiguration(() => this.updateUserOptIn(key));
    }

    private updateUserOptIn(key: string): void {
        const config = vscode.workspace.getConfiguration(TelemetryReporter.TELEMETRY_CONFIG_ID);
        if (this.userOptIn !== config.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true)) {
            this.userOptIn = config.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true);
            if (this.userOptIn) {
                this.createAppInsightsClient(key);
            } else {
                this.dispose();
            }
        }
    }
}