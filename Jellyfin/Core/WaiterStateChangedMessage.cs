namespace Jellyfin.Core;

/// <summary>
/// Defines a message indicating that the state of the waiter has changed.
/// </summary>
/// <param name="ProgressQueueElement">The queue element to notify about.</param>
public record WaiterStateChangedMessage(IProgressQueueElement ProgressQueueElement)
{
    /// <summary>
    /// Gets the progress queue element associated with the current waiter state.
    /// </summary>
    public IProgressQueueElement ProgressQueueElement { get; } = ProgressQueueElement;
}
