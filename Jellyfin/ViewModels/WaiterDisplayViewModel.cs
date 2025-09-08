#pragma warning disable CS0414 // Field is assigned but its value is never used

using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Messaging;
using Jellyfin.Controls;
using Jellyfin.Core;
using Jellyfin.Core.Contract;

namespace Jellyfin.ViewModels;

public partial class WaiterDisplayViewModel : ObservableRecipient, IRecipient<WaiterStateChangedMessage>
{
    private readonly IWaiterService _waiterService;

    [ObservableProperty]
    private bool _isWorking;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsWorking))]
    private IProgressQueueElement _currentProgress;

    public WaiterDisplayViewModel(IWaiterService waiterService, IMessenger messenger) : base(messenger)
    {
        _waiterService = waiterService;
        _isWorking = false;
        _currentProgress = null;
        RefreshState();
        IsActive = true;
    }

    /// <inheritdoc />
    public void Receive(WaiterStateChangedMessage message)
    {
        RefreshState();
    }

    private void RefreshState()
    {
        CurrentProgress = _waiterService.CurrentProgress;
        IsWorking = CurrentProgress is not null;
    }
}
