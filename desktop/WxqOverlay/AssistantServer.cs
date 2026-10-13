using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace WxqOverlay;

static class AssistantServer
{
    static readonly Regex IdOk = new("^[A-Za-z0-9_-]{8,80}$", RegexOptions.Compiled);
    static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    static readonly TimeSpan LockTtl = TimeSpan.FromMinutes(2);

    sealed record WriterStamp(string Host, int Pid, string At);

    public static void Release(AppPaths paths)
    {
        var current = ReadLock(paths);
        if (current is not null && current.Host == Environment.MachineName && current.Pid == Environment.ProcessId)
        {
            try { File.Delete(LockFile(paths)); } catch { /* 退出时锁文件可能已被同步端占用 */ }
        }
    }

    public static void Map(WebApplication app, AppPaths paths)
    {
        var web = Path.GetFullPath(paths.Web);
        var data = Path.GetFullPath(paths.Data);
        if (Directory.Exists(data))
        {
            app.Use(async (ctx, next) =>
            {
                if (ctx.Request.Path.StartsWithSegments("/data", out var rest)
                    && rest.Value?.Split('/').Any(seg => seg.StartsWith('.')) == true)
                {
                    ctx.Response.StatusCode = 404;
                    return;
                }
                await next();
            });
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(data),
                RequestPath = "/data",
            });
        }
        if (Directory.Exists(web))
        {
            app.UseStaticFiles(new StaticFileOptions
            {
                FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(web),
            });
        }

        app.MapGet("/version.json", () => Results.Json(new { version = paths.Version, name = "wxq-lab" }));
        app.MapGet("/api/assistant/status", () =>
        {
            var current = ReadLock(paths);
            var fresh = current is not null && LockFresh(current);
            var mine = fresh && current!.Host == Environment.MachineName && current.Pid == Environment.ProcessId;
            return Results.Json(new
            {
                dir = paths.UserData,
                host = Environment.MachineName,
                pid = Environment.ProcessId,
                writable = !fresh || mine,
                singleWriter = true,
                @lock = fresh ? current : null,
                note = "同一时间只应有一台电脑写入。另一台若正打开着，本机会拒绝保存。",
                version = paths.Version,
            });
        });
        app.MapGet("/api/assistant/matches", () => Results.Text(ReadText(MatchesFile(paths)), "application/json; charset=utf-8"));
        app.MapPut("/api/assistant/matches", async (HttpRequest req) =>
        {
            var node = JsonNode.Parse(await ReadBody(req)) as JsonObject;
            if (node is null) return Results.BadRequest(new { error = "记录不是对象" });
            var id = node["id"]?.GetValue<string>() ?? "";
            if (!IdOk.IsMatch(id)) return Results.BadRequest(new { error = "对局 id 无效" });
            if (!PlacementRules.IsLegal(node["placement"], out var reason))
            {
                var flagged = node["placementError"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(flagged)) return Results.BadRequest(new { error = reason });
            }
            if (!TryAcquire(paths, out var locked)) return Results.Json(new { error = locked }, statusCode: 409);
            var all = ReadArray(paths);
            var index = IndexOf(all, id);
            if (index >= 0) all[index] = node;
            else all.Insert(0, node);
            WriteArray(paths, all);
            return Results.Text(node.ToJsonString(), "application/json; charset=utf-8");
        });
        app.MapDelete("/api/assistant/matches/{id}", (string id) =>
        {
            if (!TryAcquire(paths, out var locked)) return Results.Json(new { error = locked }, statusCode: 409);
            var all = ReadArray(paths);
            all.RemoveAll(row => row?["id"]?.GetValue<string>() == id);
            WriteArray(paths, all);
            return Results.Json(new { ok = true });
        });
        app.MapPost("/api/assistant/import", async (HttpRequest req) =>
        {
            var parsed = JsonNode.Parse(await ReadBody(req));
            var incoming = parsed as JsonArray ?? parsed?["matches"] as JsonArray;
            if (incoming is null) return Results.BadRequest(new { error = "导入内容必须是数组" });
            if (!TryAcquire(paths, out var locked)) return Results.Json(new { error = locked }, statusCode: 409);
            var all = ReadArray(paths);
            var results = new JsonArray();
            foreach (var item in incoming)
            {
                if (item is not JsonObject row) continue;
                var id = row["id"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(id) || !IdOk.IsMatch(id))
                {
                    row["id"] = "imp_" + Guid.NewGuid().ToString("N");
                }
                if (!PlacementRules.IsLegal(row["placement"], out var reason))
                {
                    row["placementRaw"] = row["placement"]?.DeepClone();
                    row["placementError"] = reason;
                }
                var key = row["id"]!.GetValue<string>();
                var index = IndexOf(all, key);
                if (index >= 0) all[index] = row;
                else all.Insert(0, row);
                results.Add(new JsonObject
                {
                    ["ok"] = true,
                    ["id"] = key,
                    ["placement"] = row["placement"]?.DeepClone(),
                    ["placementError"] = row["placementError"]?.DeepClone(),
                });
            }
            WriteArray(paths, all);
            return Results.Text(results.ToJsonString(), "application/json; charset=utf-8");
        });
        app.MapPost("/api/assistant/backup", () =>
        {
            var src = MatchesFile(paths);
            if (!File.Exists(src)) File.WriteAllText(src, "[]");
            var dest = Path.Combine(paths.UserData, "backups", "matches-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".json");
            File.Copy(src, dest, true);
            return Results.Json(new { file = dest });
        });
        app.MapGet("/api/assistant/export", () => Results.Text(ReadText(MatchesFile(paths)), "application/json; charset=utf-8"));
        app.MapGet("/__/meta-dirs", () =>
        {
            var meta = Path.Combine(paths.Data, "meta");
            var dirs = Directory.Exists(meta)
                ? Directory.GetDirectories(meta).Select(Path.GetFileName).Where(name => name is not null && Regex.IsMatch(name, @"^\d{4}-\d{2}-\d{2}$")).OrderDescending()
                : Enumerable.Empty<string?>();
            return Results.Json(dirs);
        });
        app.Map("/api/update", () => Results.Json(new { error = "悬浮窗不抓取数据。请在 wxq-lab 里点「更新数据」，或运行 npm run update。" }, statusCode: 501));
        app.Map("/api/coach", () => Results.Json(new { error = "悬浮窗没有配置教练模型。完整页面的教练仍走源码里的 serve.mjs。" }, statusCode: 501));

        if (Directory.Exists(web))
        {
            app.MapFallback(async ctx =>
            {
                var index = Path.Combine(web, "index.html");
                if (!File.Exists(index)) { ctx.Response.StatusCode = 404; return; }
                ctx.Response.ContentType = "text/html; charset=utf-8";
                await ctx.Response.SendFileAsync(index);
            });
        }
    }

    static string MatchesFile(AppPaths paths) => Path.Combine(paths.UserData, "matches.json");
    static string LockFile(AppPaths paths) => Path.Combine(paths.UserData, "writer.lock");

    static WriterStamp? ReadLock(AppPaths paths)
    {
        var file = LockFile(paths);
        if (!File.Exists(file)) return null;
        try
        {
            var node = JsonNode.Parse(File.ReadAllText(file)) as JsonObject;
            if (node is null) return null;
            return new WriterStamp(
                node["host"]?.GetValue<string>() ?? "",
                node["pid"]?.GetValue<int>() ?? 0,
                node["at"]?.GetValue<string>() ?? "");
        }
        catch
        {
            return null;
        }
    }

    static bool LockFresh(WriterStamp stamp)
    {
        if (!DateTime.TryParse(stamp.At, null, System.Globalization.DateTimeStyles.RoundtripKind, out var at))
            return false;
        return DateTime.UtcNow - at.ToUniversalTime() < LockTtl;
    }

    static bool TryAcquire(AppPaths paths, out string error)
    {
        error = "";
        Directory.CreateDirectory(paths.UserData);
        var current = ReadLock(paths);
        var mineHost = Environment.MachineName;
        var minePid = Environment.ProcessId;
        if (current is not null && !(current.Host == mineHost && current.Pid == minePid) && LockFresh(current))
        {
            error = $"战绩正由 {current.Host} 写入。请先关闭那一台的实战助手，或等锁过期。";
            return false;
        }
        File.WriteAllText(LockFile(paths), JsonSerializer.Serialize(new
        {
            host = mineHost,
            pid = minePid,
            at = DateTime.UtcNow.ToString("o"),
        }));
        return true;
    }

    static string ReadText(string file) => File.Exists(file) ? File.ReadAllText(file) : "[]";

    static List<JsonObject> ReadArray(AppPaths paths)
    {
        var node = JsonNode.Parse(ReadText(MatchesFile(paths))) as JsonArray;
        return node?.OfType<JsonObject>().ToList() ?? new List<JsonObject>();
    }

    static void WriteArray(AppPaths paths, List<JsonObject> rows)
    {
        var array = new JsonArray();
        foreach (var row in rows) array.Add(row.DeepClone());
        var tmp = Path.Combine(paths.UserData, ".matches.tmp");
        File.WriteAllText(tmp, array.ToJsonString(Json));
        File.Move(tmp, MatchesFile(paths), true);
    }

    static int IndexOf(List<JsonObject> rows, string id)
    {
        for (var i = 0; i < rows.Count; i++)
        {
            if (rows[i]["id"]?.GetValue<string>() == id) return i;
        }
        return -1;
    }

    static async Task<string> ReadBody(HttpRequest req)
    {
        using var reader = new StreamReader(req.Body);
        var text = await reader.ReadToEndAsync();
        return string.IsNullOrWhiteSpace(text) ? "{}" : text;
    }
}
