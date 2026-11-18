import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/ui";
import { SITES, SITE_LABEL, responseRate, type AppRow } from "./shared";

const axisTick = { fill: "var(--text-muted)", fontSize: 12 };
const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--text)",
};

function MiniBars({ data, dataKey, color, unit, max }: {
  data: Record<string, string | number>[]; dataKey: string; color: string; unit?: string; max?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={132}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, max ?? "auto"]} unit={unit} />
        <YAxis type="category" dataKey="site" tick={axisTick} axisLine={false} tickLine={false} width={96} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: "var(--text)", fontWeight: 600 }}
          formatter={(v) => [`${v ?? 0}${unit ?? ""}`, dataKey === "count" ? "Applications" : "Response rate"]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SiteChart({ rows }: { rows: AppRow[] }) {
  const data = SITES.map((s) => {
    const forSite = rows.filter((r) => r.site === s);
    return { site: SITE_LABEL[s], count: forSite.length, rate: responseRate(forSite) ?? 0 };
  });
  return (
    <Panel title="By site">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-[13px] font-medium text-muted mb-2">Applications</div>
          <MiniBars data={data} dataKey="count" color="var(--text-faint)" />
        </div>
        <div>
          <div className="text-[13px] font-medium text-muted mb-2">Response rate</div>
          <MiniBars data={data} dataKey="rate" color="var(--accent-strong)" unit="%" max={100} />
        </div>
      </div>
    </Panel>
  );
}
