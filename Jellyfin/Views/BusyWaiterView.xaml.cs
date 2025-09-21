using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices.WindowsRuntime;
using Jellyfin.Utils;
using Jellyfin.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Windows.Foundation;
using Windows.Foundation.Collections;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Controls.Primitives;
using Windows.UI.Xaml.Data;
using Windows.UI.Xaml.Input;
using Windows.UI.Xaml.Media;
using Windows.UI.Xaml.Navigation;

// The Blank Page item template is documented at https://go.microsoft.com/fwlink/?LinkId=234238

namespace Jellyfin.Views;

/// <summary>
/// An empty page that can be used on its own or navigated to within a Frame.
/// </summary>
public sealed partial class BusyWaiterView : Page
{
    /// <summary>
    /// Initializes a new instance of the <see cref="BusyWaiterView"/> class.
    /// </summary>
    public BusyWaiterView()
    {
        this.InitializeComponent();
        DataContext = App.Current.Services.GetRequiredService<BusyWaiterViewModel>();
    }

    /// <inheritdoc />
    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        var busyWaiterViewModel = (BusyWaiterViewModel)DataContext;
        busyWaiterViewModel.BeginRetestLoop((e.Parameter as JellyfinServerValidationResult).Retry);
    }
}
