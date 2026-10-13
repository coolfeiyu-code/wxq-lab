namespace WxqOverlay;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        if (args.Contains("--self-test"))
        {
            Environment.Exit(PlacementRules.SelfTest() == 0 ? 0 : 1);
        }

        var paths = AppPaths.Resolve(args);
        var port = 5188;
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--port" && int.TryParse(args[i + 1], out var parsed)) port = parsed;
        }

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = AppContext.BaseDirectory,
        });
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
        var app = builder.Build();
        AssistantServer.Map(app, paths);
        app.StartAsync().GetAwaiter().GetResult();

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm($"http://127.0.0.1:{port}/#/overlay", paths));
        AssistantServer.Release(paths);
        app.StopAsync().GetAwaiter().GetResult();
    }
}
