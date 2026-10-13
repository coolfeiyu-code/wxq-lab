using Microsoft.Web.WebView2.WinForms;

namespace WxqOverlay;

sealed class MainForm : Form
{
    public MainForm(string url, AppPaths paths)
    {
        Text = "万象实战 " + paths.Version;
        AutoScaleMode = AutoScaleMode.None;
        MinimumSize = new Size(320, 480);
        ClientSize = new Size(404, 720);
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        PlaceAtTopRight();
        Shown += (_, _) =>
        {
            PlaceAtTopRight();
            TopMost = true;
            BringToFront();
        };

        var web = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(web);

        var menu = new ContextMenuStrip();
        var pin = new ToolStripMenuItem("置顶") { Checked = true, CheckOnClick = true };
        pin.CheckedChanged += (_, _) => TopMost = pin.Checked;
        menu.Items.Add(pin);
        menu.Items.Add("隐藏", null, (_, _) => Hide());
        menu.Items.Add("退出", null, (_, _) => Close());
        var tray = new NotifyIcon
        {
            Visible = true,
            Text = "万象实战",
            Icon = SystemIcons.Application,
            ContextMenuStrip = menu,
        };
        tray.DoubleClick += (_, _) => RestoreWindow();
        FormClosing += (_, _) => tray.Visible = false;

        Load += async (_, _) =>
        {
            try
            {
                await web.EnsureCoreWebView2Async();
                web.CoreWebView2.WebMessageReceived += (_, e) =>
                {
                    var msg = e.TryGetWebMessageAsString();
                    if (msg == "hide") Hide();
                };
                web.Source = new Uri(url);
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "没能打开 WebView2。Windows 需要安装 Edge WebView2 运行时。\n" + ex.Message, Text);
            }
        };
    }

    void PlaceAtTopRight()
    {
        var area = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1280, 800);
        // 这台机器上把窗体设成 460 时，实际布局大约只有七成宽，右边棋手名会被裁掉。
        var width = 700;
        var height = 1040;
        Size = new Size(width, height);
        Location = new Point(Math.Max(area.Left, area.Right - width - 16), area.Top + 16);
    }

    void RestoreWindow()
    {
        Show();
        WindowState = FormWindowState.Normal;
        PlaceAtTopRight();
        Activate();
    }
}
