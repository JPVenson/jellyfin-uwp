using System;

namespace Jellyfin.Core.Contract;

/// <summary>
/// Defines methods for managing a queue of progress elements and notifying when operations are completed.
/// </summary>
public interface IWaiterService
{
    /// <summary>
    /// Gets a value indicating whether there is an ongoing operation in the queue.
    /// </summary>
    bool IsWaiting { get; }

    /// <summary>
    /// Gets the current progress queue element being processed.
    /// </summary>
    IProgressQueueElement CurrentProgress { get; }

    /// <summary>
    /// Enqueues a new progress element to the queue and notifies if necessary.
    /// </summary>
    /// <param name="element">The progress type.</param>
    /// <exception cref="ArgumentNullException">Throws if the element is null.</exception>
    void Enqueue(IProgressQueueElement element);

    /// <summary>
    /// Notifies that a progress element has completed and removes it from the queue, updating the current state if necessary.
    /// </summary>
    /// <param name="progressQueueElement">The element to update.</param>
    void ProgressDone(IProgressQueueElement progressQueueElement);
}
