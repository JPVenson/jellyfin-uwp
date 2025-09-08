using System.ComponentModel;
using Jellyfin.ViewModels;
using Microsoft.Extensions.DependencyInjection;
using Windows.UI.Xaml;

// The User Control item template is documented at https://go.microsoft.com/fwlink/?LinkId=234236

namespace Jellyfin.Controls;

[DefaultProperty(nameof(Child))]
public sealed partial class WaiterDisplay
{
    public static readonly DependencyProperty ChildProperty = DependencyProperty.Register(
        nameof(Child), typeof(FrameworkElement), typeof(WaiterDisplay), new PropertyMetadata(default(FrameworkElement)));

    public WaiterDisplay()
    {
        InitializeComponent();
        DataContext = App.Current.Services.GetRequiredService<WaiterDisplayViewModel>();
    }

    public FrameworkElement Child
    {
        get { return (FrameworkElement)GetValue(ChildProperty); }
        set { SetValue(ChildProperty, value); }
    }
}
