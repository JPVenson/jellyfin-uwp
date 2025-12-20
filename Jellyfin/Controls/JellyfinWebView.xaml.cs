using System;
using Jellyfin.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Windows.UI.Xaml;

namespace Jellyfin.Controls;

/// <summary>
/// Represents a custom web view control for interacting with a Jellyfin server.
/// </summary>
public sealed partial class JellyfinWebView
{
    /// <summary>
    /// Initializes a new instance of the <see cref="JellyfinWebView"/> class.
    /// </summary>
    public JellyfinWebView()
    {
        InitializeComponent();
        DataContext = App.Current.Services.GetRequiredService<JellyfinWebViewModel>();
        Loaded += JellyfinWebView_Loaded;
    }

    private void JellyfinWebView_Loaded(object sender, RoutedEventArgs e)
    {
        Loaded -= JellyfinWebView_Loaded;
        (DataContext as JellyfinWebViewModel)?.InitializeWebView();
    }
}
