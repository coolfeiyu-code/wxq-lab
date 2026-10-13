namespace WxqOverlay;

sealed record AppPaths(string Web, string Data, string UserData, string Version)
{
    public static AppPaths Resolve(string[] args)
    {
        var exe = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string? product = null;
        string? repo = null;
        var dir = exe;
        for (var hop = 0; hop < 8 && !string.IsNullOrEmpty(dir); hop++)
        {
            if (File.Exists(Path.Combine(dir, "VERSION")) && File.Exists(Path.Combine(dir, "app", "web", "index.html")))
            {
                product = dir;
                break;
            }
            if (repo is null && File.Exists(Path.Combine(dir, "VERSION")) && File.Exists(Path.Combine(dir, "data", "heroes.json")))
                repo = dir;
            var parent = Path.GetDirectoryName(dir);
            if (string.IsNullOrEmpty(parent) || parent == dir) break;
            dir = parent;
        }

        string web;
        string data;
        string user;
        string versionFile;
        if (product is not null)
        {
            web = Path.Combine(product, "app", "web");
            var bundled = Path.Combine(product, "data");
            var siblingRepo = Path.GetFullPath(Path.Combine(product, "..", "wxq-lab", "data"));
            data = File.Exists(Path.Combine(bundled, "heroes.json"))
                ? bundled
                : siblingRepo;
            user = Path.Combine(product, "user-data");
            versionFile = Path.Combine(product, "VERSION");
        }
        else if (repo is not null)
        {
            var dist = Path.Combine(repo, "dist");
            web = File.Exists(Path.Combine(dist, "index.html")) ? dist : Path.Combine(repo, "ui", "dist");
            data = Path.Combine(repo, "data");
            user = Path.GetFullPath(Path.Combine(repo, "..", "万象棋AI实战助手", "user-data"));
            versionFile = Path.Combine(repo, "VERSION");
        }
        else
        {
            var fallback = Path.GetFullPath(Path.Combine(exe, "..", ".."));
            web = Path.Combine(fallback, "app", "web");
            data = Path.Combine(fallback, "data");
            user = Path.Combine(fallback, "user-data");
            versionFile = Path.Combine(fallback, "VERSION");
        }
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--web") web = Path.GetFullPath(args[i + 1]);
            if (args[i] == "--data") data = Path.GetFullPath(args[i + 1]);
            if (args[i] == "--user-data") user = Path.GetFullPath(args[i + 1]);
        }
        var version = File.Exists(versionFile) ? File.ReadAllText(versionFile).Trim() : "1.0.0";
        Directory.CreateDirectory(user);
        Directory.CreateDirectory(Path.Combine(user, "backups"));
        return new AppPaths(web, data, user, version);
    }
}
