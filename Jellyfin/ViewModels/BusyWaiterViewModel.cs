#pragma warning disable CS0169 // Field is never used
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging.Messages;
using Jellyfin.Core;
using Jellyfin.Utils;
using Jellyfin.Views;
using Windows.UI.Core;
using Windows.UI.Xaml.Controls;

namespace Jellyfin.ViewModels;

/// <summary>
/// ViewModel for the BusyWaiter control.
/// </summary>
public partial class BusyWaiterViewModel : ObservableObject
{
    private readonly Frame _frame;
    private readonly CoreDispatcher _dispatcher;
    private readonly CancellationTokenSource _stopCancellationTokenSource = new();
    private CancellationTokenSource _retryInterruptCancellationTokenSource = new();

    [ObservableProperty]
    private string _retestMessage;

    [ObservableProperty]
    private int _retestCountdown;

    [ObservableProperty]
    private bool _isBusyWaiting;

    /// <summary>
    /// Initializes a new instance of the <see cref="BusyWaiterViewModel"/> class.
    /// </summary>
    /// <param name="frame">The <see cref="Frame"/> used for navigation or UI context.</param>
    /// <param name="dispatcher">The <see cref="CoreDispatcher"/> used to execute operations on the UI thread.</param>
    public BusyWaiterViewModel(Frame frame, CoreDispatcher dispatcher)
    {
        _frame = frame;
        _dispatcher = dispatcher;
    }

    /// <summary>
    /// Gets the interval between retest attempts.
    /// </summary>
    public TimeSpan RetestInterval { get; private set; }

    /// <summary>
    /// Command to abort the waiting and retry process.
    /// </summary>
    [RelayCommand]
    public void ExecuteAbortWaiting()
    {
        _stopCancellationTokenSource.Cancel();
    }

    /// <summary>
    /// Command to interrupt the current retest countdown and immediately attempt to reconnect.
    /// </summary>
    [RelayCommand(CanExecute = nameof(CanInterruptRetestLoop))]
    public void InterruptRetestLoop()
    {
        _retryInterruptCancellationTokenSource.Cancel();
    }

    /// <summary>
    /// Determines whether the retest loop can be interrupted.
    /// </summary>
    /// <returns><see langword="true"/> if the retest loop can be interrupted; otherwise, <see langword="false"/>.</returns>
    public bool CanInterruptRetestLoop() => !IsBusyWaiting;

    /// <summary>
    /// Begins a task that will retry connecting to the Jellyfin server after a specified interval.
    /// </summary>
    /// <param name="retry">The retry interval.</param>
    public void BeginRetestLoop(TimeSpan? retry)
    {
        _retryInterruptCancellationTokenSource = new();
        RetestInterval = retry ?? TimeSpan.FromSeconds(60);
        var combinedToken = CancellationTokenSource.CreateLinkedTokenSource(_retryInterruptCancellationTokenSource.Token, _stopCancellationTokenSource.Token);
        Task.Run(async () =>
        {
            IsBusyWaiting = true;
            for (int i = (int)RetestInterval.TotalSeconds; i >= 0; i--)
            {
                RetestCountdown = i;
                RetestMessage = $"Retrying in {i} second{(i == 1 ? " " : "s")} ...";
                await Task.Delay(1000, combinedToken.Token);
                if (combinedToken.Token.IsCancellationRequested)
                {
                    break;
                }
            }

            IsBusyWaiting = false;

            if (_stopCancellationTokenSource.Token.IsCancellationRequested)
            {
                return;
            }

            RetestMessage = $"Retrying now to connect to \"{Central.Settings.JellyfinServer}\" ...";

            var jellyfinServerCheck = await ServerCheckUtil.IsJellyfinServerUrlValidAsync(new Uri(Central.Settings.JellyfinServer)).ConfigureAwait(true);

            if (_stopCancellationTokenSource.Token.IsCancellationRequested)
            {
                return;
            }

            if (jellyfinServerCheck.IsValid)
            {
                await _dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
                {
                    _frame.Navigate(typeof(MainPage));
                });
            }
            else if (jellyfinServerCheck.IsTemporaryError)
            {
                BeginRetestLoop(jellyfinServerCheck.Retry);
            }
            else
            {
                await _dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
                {
                    _frame.Navigate(typeof(OnBoarding), new OnBoardingParameter()
                    {
                        ErrorMessage = "Could not connect to the Jellyfin server as it returned an error: " + jellyfinServerCheck.ErrorMessage,
                    });
                });
            }
        });
    }
}
