using System;
using System.Collections.Generic;
using System.Linq;
using CommunityToolkit.Mvvm.Messaging;
using Jellyfin.Core.Contract;

namespace Jellyfin.Core;

/// <summary>
/// Defines a service that manages a queue of progress elements, allowing for tracking and notification of ongoing operations.
/// </summary>
public class WaiterService : IWaiterService
{
    private readonly IMessenger _messenger;
    private readonly List<ProgressElement> _progressQueue;
    private ProgressElement _currentProgress;

    /// <summary>
    /// Initializes a new instance of the <see cref="WaiterService"/> class.
    /// </summary>
    /// <param name="messenger">The messenger service.</param>
    public WaiterService(IMessenger messenger)
    {
        _messenger = messenger;
        _progressQueue = new();
    }

    /// <summary>
    /// Gets a value indicating whether there is an ongoing operation in the queue.
    /// </summary>
    public bool IsWaiting
    {
        get { return CurrentProgress != null; }
    }

    /// <summary>
    /// Gets the current progress queue element being processed.
    /// </summary>
    public IProgressQueueElement CurrentProgress
    {
        get
        {
            return _currentProgress.ProgressQueueElement;
        }
    }

    /// <summary>
    /// Enqueues a new progress element to the queue and notifies if necessary.
    /// </summary>
    /// <param name="element">The progress type.</param>
    /// <exception cref="ArgumentNullException">Throws if the element is null.</exception>
    public void Enqueue(IProgressQueueElement element)
    {
        if (element == null)
        {
            throw new ArgumentNullException(nameof(element));
        }

        _progressQueue.Add(new()
        {
            ProgressQueueElement = element
        });

        UpdateIfNecessary();
    }

    /// <summary>
    /// Notifies that a progress element has completed and removes it from the queue, updating the current state if necessary.
    /// </summary>
    /// <param name="progressQueueElement">The element to update.</param>
    public void ProgressDone(IProgressQueueElement progressQueueElement)
    {
        _progressQueue.RemoveAll(e => e.ProgressQueueElement == progressQueueElement);
        UpdateIfNecessary();
    }

    private void UpdateIfNecessary()
    {
        var newCurrent = _progressQueue.FirstOrDefault();
        if (newCurrent != _currentProgress)
        {
            _currentProgress = newCurrent;
            _messenger.Send(new WaiterStateChangedMessage(newCurrent?.ProgressQueueElement));
        }
    }

    private class ProgressElement
    {
        public IProgressQueueElement ProgressQueueElement { get; set; }
    }
}
