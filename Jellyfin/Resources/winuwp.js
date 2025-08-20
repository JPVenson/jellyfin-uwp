(function (appName, appVersion, deviceName, supportsHdr10, supportsDolbyVision) {
    'use strict';

    console.log('Windows UWP adapter');
    if (chrome && chrome.webview) {
        console.log('Setting up WinRT projection options');
        chrome.webview.hostObjects.options.defaultSyncProxy = true;
        chrome.webview.hostObjects.options.forceAsyncMethodMatches = [/Async$/, /AsyncWithSpeller$/];
        chrome.webview.hostObjects.options.ignoreMemberNotFoundError = true;
        window.WindowsProxy = chrome.webview.hostObjects.sync.Windows;
    }

    const xbox = deviceName.toLowerCase().indexOf('xbox') !== -1;
    const xboxSeries = deviceName.toLowerCase().indexOf('xbox series') !== -1;
    const mobile = deviceName.toLowerCase().indexOf('mobile') !== -1;

    function postMessage(type, args = {}) {
        console.debug(`AppHost.${type}`, args);
        const payload = {
            'type': type,
            'args': args
        };

        window.chrome.webview.postMessage(JSON.stringify(payload));
    }

    const AppInfo = {
        deviceName: deviceName,
        appName: appName,
        appVersion: appVersion
    };

    // List of supported features
    const SupportedFeatures = [
        'displaylanguage',
        'displaymode',
        'exit',
        'exitmenu',
        'externallinkdisplay',
        'externallinks',
        'htmlaudioautoplay',
        'htmlvideoautoplay',
        'multiserver',
        'otherapppromotions',
        'screensaver',
        'subtitleappearancesettings',
        'subtitleburnsettings',
        'targetblank'
    ];

    if (xbox || mobile) {
        SupportedFeatures.push('physicalvolumecontrol');
    }

    SupportedFeatures.push('clientsettings');

    console.debug('SupportedFeatures', SupportedFeatures);

    window.NativeShell = {
        AppHost: {
            init: function () {
                console.debug('AppHost.init', AppInfo);
                return Promise.resolve(AppInfo);
            },

            appName: function () {
                console.debug('AppHost.appName', AppInfo.appName);
                return AppInfo.appName;
            },

            appVersion: function () {
                console.debug('AppHost.appVersion', AppInfo.appVersion);
                return AppInfo.appVersion;
            },

            deviceName: function () {
                console.debug('AppHost.deviceName', AppInfo.deviceName);
                return AppInfo.deviceName;
            },

            exit: function () {
                postMessage('exit');
            },

            getDefaultLayout: function () {
                let layout;
                if (xbox) {
                    layout = 'tv';
                } else if (mobile) {
                    layout = 'mobile';
                } else {
                    layout = 'desktop';
                }
                console.debug('AppHost.getDefaultLayout', layout);
                return layout;
            },

            getDeviceProfile: function (profileBuilder) {
                console.debug('AppHost.getDeviceProfile');
                const options = {};
                if (supportsHdr10 != null) {
                    options.supportsHdr10 = supportsHdr10;
                }
                if (supportsDolbyVision != null) {
                    options.supportsDolbyVision = supportsDolbyVision;
                }
                if (xboxSeries) {
                    options.maxVideoWidth = 3840;
                }
                return profileBuilder(options);
            },

            supports: function (command) {
                const isSupported = command && SupportedFeatures.indexOf(command.toLowerCase()) !== -1;
                console.debug('AppHost.supports', {
                    command: command,
                    isSupported: isSupported
                });
                return isSupported;
            }
        },

        enableFullscreen: function (videoInfo) {
            postMessage('enableFullscreen', videoInfo);
        },

        disableFullscreen: function () {
            postMessage('disableFullscreen');
        },

        getPlugins: function () {
            console.debug('getPlugins');
            return ["UwpXboxHdmiSetupPlugin"];
        },

        selectServer: function () {
            postMessage('selectServer');
        },

        openClientSettings: function () {
            postMessage('openClientSettings');
        }
    };
})(APP_NAME, APP_VERSION, DEVICE_NAME, SUPPORTS_HDR, SUPPORTS_DOVI);


/**
 * Plugin build to toggle attached HDMI monitors
 * Follows: https://github.com/jellyfin/jellyfin-web/blob/master/src/types/plugin.ts
 */
class UwpXboxHdmiSetupPlugin {
    constructor(pluginOptions) {
        this.name = "UwpXboxHdmiSetupPlugin";
        this.id = "UwpXboxHdmiSetupPlugin";
        this.type = "preplayintercept";
        this.priority = 0;
        this.PluginOptions = pluginOptions;
    }

    async intercept(options) {
        const item = options.item;
        if (!item || window.IsXboxHdmiIntegrationAllowed != true) {
            return;
        }
        if ("mediaSourceId" in options) {
            const mediaSourceid = options.mediaSourceid;
            var mediaStreams = null;
            var mediaSource = null;

            if (item.MediaSources == null) {
                const apiClient = this.PluginOptions.ServerConnections.getApiClient(item.ServerId);
                const isLiveTv = ["TvChannel", "LiveTvChannel"].includes(item.Type);
                mediaStreams = isLiveTv ? null : await apiClient.getItem(apiClient.getCurrentUserId(), mediaSourceid || item.Id)
                    .then(fullItem => {
                        mediaSource = fullItem;
                        return fullItem.MediaStreams;
                    });
            }
            else {
                mediaSource = item.MediaSources.find(e => e.id == mediaSourceid);
                if (mediaSource == null) {
                    return;
                }
                mediaStreams = mediaSource.MediaStreams;
            }

            if (mediaStreams == null || mediaStreams.length == 0) {
                return;
            }

            const stream = mediaStreams.find(s => s.Type === 'Video');

            if (stream == null) {
                return;
            }

            await this.setDisplayModeAsync(mediaSource, stream);
        }
    }

    // Calls into WinRT APIs to set the display mode of the currently attached HDMI device.
    // Returns true if the desired display mode could be set, false otherwise.
    async setDisplayModeAsync(source, stream) {
        if (stream.DvVersionMajor != null) { //"dolbyVision4k"
            return await uwpDisplayMode.switchTVModeTo4KDVAsync(source, stream);
        } else if (stream.VideoRange === "HDR") {
            return await uwpDisplayMode.switchTVModeTo4KHDRAsync(source, stream);
        } else if (stream.Height >= 2160 && stream.Width >= 3840) {
            return await uwpDisplayMode.switchTVModeTo4KSDRAsync(source, stream);
        } else if ((stream.AverageFrameRate || stream.RealFrameRate) >= 48) {
            return await uwpDisplayMode.switchTVModeTo50HzAsync(source, stream);
        } else {
            // Any display mode should work fine, make no changes
            return true;
        }
    }
}

window["UwpXboxHdmiSetupPlugin"] = async () => UwpXboxHdmiSetupPlugin;


var uwpDisplayMode = (function (WindowsProxies) {
    let public = {};

    // Common strings for device capability WinRT API calls
    const SUPPORT_SUFFIX = "\"";
    const SUPPORT_4K_FEATURES_AFFIX = "features=\"decode-res-x=3840,decode-res-y=2160,decode-bitrate=20000,decode-fps=30,decode-bpc=10,display-res-x=3840,display-res-y=2160,display-bpc=8";
    const SUPPORT_4K_MP4_PREFIX = "video/mp4;codecs=\"hvc1,mp4a\";" + SUPPORT_4K_FEATURES_AFFIX;
    const SUPPORT_4K_VP9_PREFIX = "video/mp4;codecs=\"vp09\";" + SUPPORT_4K_FEATURES_AFFIX;
    const SUPPORT_HDR_AFFIX = ",hdr=1";
    const SUPPORT_DV_AFFIX = ",ext-profile=dvhe.05";
    // await uwpDisplayMode.isTypeSupportedAsync('video/x-matroska;codecs="hevc";features="decode-res-x=3840,decode-res-y=2160,decode-bitrate=21655728,decode-fps=23.976025,decode-bpc=10,display-res-x=3840,display-res-y=2160,display-bpc=10"')
    // Strings useful for checking various kinds of video support
    public.videoTypes = {
        fullhd: "video/mp4;codecs=\"avc1,mp4a\";features=\"display-res-x=1920,display-res-y=1080,display-bpc=8\"",
        sdr4k: SUPPORT_4K_MP4_PREFIX + SUPPORT_SUFFIX,
        hdr4k: SUPPORT_4K_MP4_PREFIX + SUPPORT_HDR_AFFIX + SUPPORT_SUFFIX,
        dolbyVision: SUPPORT_4K_MP4_PREFIX + SUPPORT_HDR_AFFIX + SUPPORT_DV_AFFIX + SUPPORT_SUFFIX,
        vp9: SUPPORT_4K_VP9_PREFIX + SUPPORT_SUFFIX
    };

    // Strings useful for checking various kinds of audio support
    public.audioTypes = {
        mp4a: "video/mp4;codecs=\"avc1,mp4a\";",
        dolbyDigital: "video/mp4;codecs=\"hvc1,ac-3\";",
        dolbyDigitalPlus: "video/mp4;codecs=\"hvc1,ec-3\";"
    };

    public.buildTypeString = function (source, stream) {
        var features = `features="decode-res-x=${stream.Width},decode-res-y=${stream.Height},decode-bitrate=${stream.BitRate},decode-fps=${stream.AverageFrameRate},decode-bpc=${stream.BitDepth},display-res-x=${stream.Width},display-res-y=${stream.Height},display-bpc=${stream.BitDepth}`;
        if (stream.VideoRange == "HDR") {
            features += SUPPORT_HDR_AFFIX;
        }
        if (stream.DvVersionMajor != null) {
            // supported maybe later.
        }
        return `${this.getMimeType(source.Container)};codecs="${stream.Codec}";${features}"`
    }

    public.getMimeType = function (container) {
        if (container === 'mkv') {
            return 'video/x-matroska';
        }
        if (container === 'm4v') {
            return 'video/mp4';
        }
        if (container === 'mov') {
            return 'video/quicktime';
        }
        if (container === 'mpg') {
            return 'video/mpeg';
        }
        if (container === 'flv') {
            return 'video/x-flv';
        }
        return "video/mp4";
    }

    // Sample function which switches the display to 4K Dolby Vision mode,
    // if supported. Returns false otherwise, and prints warnings to the console.
    public.switchTVModeTo4KDVAsync = async function (source, stream) {
        //var mediaString = this.buildTypeString(source, stream);
        //// Validate display supports Dolby Vision and HDCP2
        //if (!await this.isTypeSupportedAsync(mediaString)) {
        //    console.warn("Display does not support 4K Dolby Vision");
        //    return false;
        //}

        let hdmiInfo = WindowsProxies.Graphics.Display.Core.HdmiDisplayInformation.getForCurrentView();
        if (hdmiInfo == null) {
            return false;
        }
        let modes = hdmiInfo.getSupportedDisplayModes();

        // Find the Dolby Vision mode
        let desiredMode = modes.find(mode =>
            (mode.refreshRate + 0.5) >= 60 && // Some TVs report a refresh rate a few decimals lower than
            (mode.refreshRate + 0.5) < 120 && // 60 or 120. Add a small delta to bump it over the threshold.
            mode.resolutionWidthInRawPixels >= 3840 &&
            mode.isDolbyVisionLowLatencySupported);

        // Change to the desired mode, if able
        if (!desiredMode) {
            return false;
        } else {
            return await WindowsProxies.GraphicsDisplayProxies.requestSetCurrentDisplayModeAsync(
                desiredMode, WindowsProxies.Graphics.Display.Core.HdmiDisplayHdrOption.dolbyVisionLowLatency);
        }
    };

    // Sample function which switches the display to 4K HDR mode,
    // if supported. Returns false otherwise, and prints warnings to the console.
    public.switchTVModeTo4KHDRAsync = async function (source, stream) {
        //var mediaString = this.buildTypeString(source, stream);
        //// Validate display supports 4K HDR and HDCP2
        //if (!await this.isTypeSupportedAsync(mediaString)) {
        //    console.warn("Display does not support 4K HDR");
        //    return false;
        //}

        let hdmiInfo = WindowsProxies.Graphics.Display.Core.HdmiDisplayInformation.getForCurrentView();
        if (hdmiInfo == null) {
            return false;
        }
        let modes = hdmiInfo.getSupportedDisplayModes();

        // Find the appropriate mode
        let desiredMode = modes.find(mode =>
            (mode.refreshRate + 0.5) >= 60 && // Some TVs report a refresh rate a few decimals lower than
            (mode.refreshRate + 0.5) < 120 && // 60 or 120. Add a small delta to bump it over the threshold.
            mode.resolutionWidthInRawPixels >= 3840 &&
            mode.isSmpte2084Supported);

        // Change to the desired mode, if able
        if (!desiredMode) {
            return false;
        } else {
            return await WindowsProxies.GraphicsDisplayProxies.requestSetCurrentDisplayModeAsync(
                desiredMode, WindowsProxies.Graphics.Display.Core.HdmiDisplayHdrOption.eotf2084);
        }
    };

    // Sample function which switches the display to 4K SDR mode,
    // if supported. Returns false otherwise, and prints warnings to the console.
    public.switchTVModeTo4KSDRAsync = async function (source, stream) {
        //var mediaString = this.buildTypeString(source, stream);
        //// Validate display supports 4K SDR and HDCP
        //if (!await this.isTypeSupportedAsync(mediaString)) {
        //    console.warn("Display does not support 4K Resolution");
        //    return false;
        //}

        let hdmiInfo = WindowsProxies.Graphics.Display.Core.HdmiDisplayInformation.getForCurrentView();
        if (hdmiInfo == null) {
            return false;
        }
        let modes = hdmiInfo.getSupportedDisplayModes();

        // Find the appropriate mode
        let desiredMode = modes.find(mode =>
            (mode.refreshRate + 0.5) >= 60 && // Some TVs report a refresh rate a few decimals lower than
            (mode.refreshRate + 0.5) < 120 && // 60 or 120. Add a small delta to bump it over the threshold.
            mode.resolutionWidthInRawPixels >= 3840 &&
            mode.isSdrLuminanceSupported);

        // Change to the desired mode, if able
        if (!desiredMode) {
            return false;
        } else {
            return await WindowsProxies.GraphicsDisplayProxies.requestSetCurrentDisplayModeAsync(
                desiredMode, WindowsProxies.Graphics.Display.Core.HdmiDisplayHdrOption.eotfSdr);
        }
    };

    // Sample function which switches the display to a 50Hz display mode,
    // if supported. Returns false otherwise, and prints warnings to the console.
    // If your content is authored with a 25Hz or 50Hz refresh rate, setting the
    // display to a 50Hz display mode is important to avoid visual judder.
    public.switchTVModeTo50HzAsync = async function (source, stream) {
        var mediaString = this.buildTypeString(source, stream);
        let hdmiInfo = WindowsProxies.Graphics.Display.Core.HdmiDisplayInformation.getForCurrentView();
        if (hdmiInfo == null) {
            return false;
        }
        let modes = hdmiInfo.getSupportedDisplayModes();

        // Find the first 50Hz mode
        // If your content has other display needs (such as 4K, or HDR) you should modify this code to
        // check for those as well.
        let desiredMode = modes.find(mode =>
            (mode.refreshRate + 0.5) >= 50 && // Some TVs report a refresh rate a few decimals lower than
            (mode.refreshRate + 0.5) < 60);   // 50 or 60. Add a small delta to bump it over the threshold.

        // Change to the desired mode, if able
        if (!desiredMode) {
            return false;
        } else {
            return await WindowsProxies.GraphicsDisplayProxies.requestSetCurrentDisplayModeAsync(
                desiredMode, Windows.Graphics.Display.Core.HdmiDisplayHdrOption.none);
        }
    };

    // Calls WindowsProxies.Media.Protection.ProtectionCapabilities().IsTypeSupported() in a loop
    // until it gets a non-maybe result.
    // https://learn.microsoft.com/en-us/uwp/api/windows.media.protection.protectioncapabilities.istypesupported
    public.isTypeSupportedAsync = async function (type) {
        try {
            // This string checks for PlayReady SL3000 (hardware) support. Your app must
            // specify the hevcPlayback capability in its appxmanifest file to use SL3000.
            // If you only need SL2000, use "com.microsoft.playready.recommendation" instead.
            // For more information see:
            // https://learn.microsoft.com/en-us/playready/overview/key-system-strings
            let playReadyVersion = "na";
            let protCap = WindowsProxies.Media.Protection.ProtectionCapabilities();
            let result = protCap.isTypeSupported(type, playReadyVersion);

            // Continue checking until we get a non-maybe result. This API will not return
            // "maybe" for more than 5 seconds.
            for (let i = 0; i < 5 && result == WindowsProxies.Media.Protection.ProtectionCapabilityResult.maybe; i++) {
                await new Promise(r => setTimeout(r, 100));
                result = protCap.isTypeSupported(type, playReadyVersion);
            }

            return (result != WindowsProxies.Media.Protection.ProtectionCapabilityResult.notSupported);
        } catch (error) {
            console.error(error);
        }

        return false;
    };

    return public;
}(WindowsProxy));
