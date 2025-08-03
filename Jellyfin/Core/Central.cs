using System;

namespace Jellyfin.Core;

/// <summary>
/// Provides access to core application services and managers.
/// </summary>
public static class Central
{
    /// <summary>
    /// Gets the settings manager for application configuration.
    /// </summary>
    public static SettingsManager Settings { get; } = new SettingsManager();

    /// <summary>
    /// Gets the minimum supported version of the Jellyfin application for this version of the client.
    /// </summary>
    public static Version MinimumSupportedVersion { get; } = new Version(10, 11, 0, 0);
}
