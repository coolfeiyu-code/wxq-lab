using System.Text.Json;
using System.Text.Json.Nodes;

namespace WxqOverlay;

static class PlacementRules
{
    public static bool IsLegal(JsonNode? node, out string reason)
    {
        reason = "";
        if (node is null || node.GetValueKind() == JsonValueKind.Null) return true;
        if (node is not JsonValue value || value.GetValueKind() != JsonValueKind.Number || !value.TryGetValue<int>(out var number) || number is < 1 or > 6)
        {
            reason = $"名次 {node} 非法。对局固定 6 人，只能是 1、2、3、4、5、6";
            return false;
        }
        return true;
    }

    public static int SelfTest()
    {
        var failures = 0;
        foreach (var raw in new[] { "1", "2", "3", "4", "5", "6" })
        {
            var node = JsonNode.Parse(raw);
            if (!IsLegal(node, out _)) failures++;
        }
        foreach (var raw in new[] { "0", "7", "8", "-1", "1.5", "\"6\"" })
        {
            var node = JsonNode.Parse(raw);
            if (IsLegal(node, out _)) failures++;
        }
        if (IsLegal(null, out _)) { /* missing is allowed on save */ }
        else failures++;
        return failures;
    }
}
