/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as os from 'os';
import * as vscode from 'vscode';
import * as appInsights from 'applicationinsights';
import * as winreg from 'winreg';

export default class TelemetryReporter extends vscode.Disposable {
    private appInsightsClient: typeof appInsights.client;
    private commonProperties: { [key: string]: string };
    private userOptIn: boolean = true;
    private toDispose: vscode.Disposable[] = [];

    private static SQM_KEY = '\\SOFTWARE\\Microsoft\\SQMClient';
    private static REGISTRY_USERID_VALUE = 'UserId';
    private static REGISTRY_MACHINEID_VALUE = 'MachineId';
    private static TELEMETRY_CONFIG_ID = 'telemetry';
    private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';

    constructor(private extensionId: string, private extensionVersion: string, key: string) {
        super(() => this.toDispose.forEach((d) => d && d.dispose()))

        //check if another instance is already initialized
        if (appInsights.client) {
            this.appInsightsClient = appInsights.getClient(key);
            // no other way to enable offline mode
            this.appInsightsClient.channel.setOfflineMode(true);
        } else {
            this.appInsightsClient = appInsights.setup(key)
                .setAutoCollectRequests(false)
                .setAutoCollectPerformance(false)
                .setAutoCollectExceptions(false)
                .setAutoCollectDependencies(false)
                .setOfflineMode(true)
                .start()
                .client;
        }

        //prevent AI from reporting PII
        this.setupAIClient(this.appInsightsClient);

        //check if it's an Asimov key to change the endpoint
        if (key && key.indexOf('AIF-') === 0) {
            this.appInsightsClient.config.endpointUrl = "https://vortex.data.microsoft.com/collect/v1";
        }

        this.loadCommonProperties();

        if (vscode && vscode.env) {
            this.loadVSCodeCommonProperties(vscode.env.machineId, vscode.env.sessionId, vscode.version);
        }

        this.updateUserOptIn();
        this.toDispose.push(vscode.workspace.onDidChangeConfiguration(() => this.updateUserOptIn()));
    }

    private updateUserOptIn(): void {
        const config = vscode.workspace.getConfiguration(TelemetryReporter.TELEMETRY_CONFIG_ID);
        this.userOptIn = config.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true);
    }

    private setupAIClient(client: typeof appInsights.client): void {
        if (client && client.context && client.context.keys && client.context.tags) {
            var machineNameKey = client.context.keys.deviceMachineName;
            client.context.tags[machineNameKey] = '';
        }
    }

    // __GDPR__COMMON__ "common.vscodemachineid" : { "classification": "EndUserPseudonymizedInformation", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.vscodesessionid" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.vscodeversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    private loadVSCodeCommonProperties(machineId: string, sessionId: string, version: string): void {
        this.commonProperties = this.commonProperties || Object.create(null);
        this.commonProperties['vscodemachineid'] = machineId;
        this.commonProperties['vscodesessionid'] = sessionId;
        this.commonProperties['vscodeversion'] = version;
    }

    // __GDPR__COMMON__ "common.os" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.osversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.extname" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.extversion" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.sqmid" : { "endPoint": "SqmUserId", "classification": "EndUserPseudonymizedInformation", "purpose": "FeatureInsight" }
    // __GDPR__COMMON__ "common.sqmmachineid" : { "endPoint": "SqmMachineId", "classification": "EndUserPseudonymizedInformation", "purpose": "FeatureInsight" }
    private loadCommonProperties(): void {
        this.commonProperties = this.commonProperties || Object.create(null);
        this.commonProperties['os'] = os.platform();
        this.commonProperties['osversion'] = os.release();
        this.commonProperties['extname'] = this.extensionId;
        this.commonProperties['extversion'] = this.extensionVersion;

        // add SQM data for windows machines
        if (process.platform === 'win32') {
            this.getWinRegKeyData(TelemetryReporter.SQM_KEY, TelemetryReporter.REGISTRY_USERID_VALUE, winreg.HKCU, (error, result: string) => {
                if (!error && result) {
                    this.commonProperties['sqmid'] = result;
                }
            });

            this.getWinRegKeyData(TelemetryReporter.SQM_KEY, TelemetryReporter.REGISTRY_MACHINEID_VALUE, winreg.HKLM, (error, result) => {
                if (!error && result) {
                    this.commonProperties['sqmmachineid'] = result;
                }
            });
        }
    }

    private addCommonProperties(properties: { [key: string]: string }): { [key: string]: string } {
        for (var prop in this.commonProperties) {
            properties['common.' + prop] = this.commonProperties[prop];
        }
        return properties;
    }

    private getWinRegKeyData(key: string, name: string, hive: string, callback: (error: Error | null, userId: string | null) => void): void {
        if (process.platform === 'win32') {
            try {
                var reg = new winreg({ hive: hive, key: key });

                reg.get(name, (e, result) => {
                    if (e || !result) {
                        callback(e, null);
                    } else {
                        callback(null, result.value);
                    }
                });
            } catch (err) {
                callback(err, null);
            }
        } else {
            callback(null, null);
        }
    }

    public sendTelemetryEvent(eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }): void {
        if (this.userOptIn && eventName) {
            let eventProperties = properties || Object.create(null);
            eventProperties = this.addCommonProperties(eventProperties);
            this.appInsightsClient.trackEvent(`${this.extensionId}/${eventName}`, eventProperties, measures);
        }
    }
}