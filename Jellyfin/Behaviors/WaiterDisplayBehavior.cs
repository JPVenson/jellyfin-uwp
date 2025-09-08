using System.Linq;
using CommunityToolkit.Mvvm.Messaging;
using Jellyfin.Controls;
using Jellyfin.Core;
using Jellyfin.Core.Contract;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Xaml.Interactivity;
using Windows.UI.Xaml.Controls;

namespace Jellyfin.Behaviors;

public class WaiterDisplayBehavior : Behavior<Grid>, IRecipient<WaiterStateChangedMessage>
{
    private IWaiterService _waiterService;
    private IMessenger _messenger;

    protected override void OnAttached()
    {
        _waiterService = App.Current.Services.GetRequiredService<IWaiterService>();
        _messenger = App.Current.Services.GetRequiredService<IMessenger>();
        _messenger.Register(this);
        RefreshState();
        base.OnAttached();
    }

    protected override void OnDetaching()
    {
        base.OnDetaching();
    }

    /// <inheritdoc />
    public void Receive(WaiterStateChangedMessage message)
    {
        RefreshState();
    }

    private void RefreshState()
    {
        var existingWaiter = AssociatedObject.Children.OfType<WaiterDisplay>().FirstOrDefault();
        if (_waiterService.CurrentProgress is null && existingWaiter != null)
        {
            AssociatedObject.Children.Remove(existingWaiter);
        }
        else if (_waiterService.CurrentProgress is not null)
        {
            if (existingWaiter == null)
            {
                existingWaiter = new WaiterDisplay();
                AssociatedObject.Children.Add(existingWaiter);
            }

            existingWaiter.DataContext = _waiterService.CurrentProgress;
        }
    }
}
