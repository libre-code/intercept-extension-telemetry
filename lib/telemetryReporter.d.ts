export default class TelemetryReporter {
    private extensionId;
    private extensionVersion;
    private createAppInsightsClient;
    dispose: () => Promise<any>;
    sendTelemetryErrorEvent: (eventName: string, properties?: {
        [key: string]: string;
    }, measurements?: {
        [key: string]: number;
    }, errorProps?: string[]) => void;
    sendTelemetryEvent: (eventName: string, properties?: {
        [key: string]: string;
    }, measurements?: {
        [key: string]: number;
    }) => void;
    sendTelemetryException: (error: Error, properties?: {
        [key: string]: string;
    }, measurements?: {
        [key: string]: number;
    }) => void;
    private userOptIn;
    private readonly configListener;
    private static TELEMETRY_CONFIG_ID;
    private static TELEMETRY_CONFIG_ENABLED_ID;
    constructor(extensionId: string, extensionVersion: string, key: string, firstParty?: boolean);
    private updateUserOptIn;
}
