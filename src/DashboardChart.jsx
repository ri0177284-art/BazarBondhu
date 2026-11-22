import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function DashboardChart({ data, money }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#edf1ee" vertical={false} />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#849087", fontSize: 12 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#849087", fontSize: 12 }} />
        <Tooltip formatter={(value) => money(value)} contentStyle={{ borderRadius: 12, border: "1px solid #e6ece8" }} />
        <Bar dataKey="sales" name="বিক্রি" fill="#13834b" radius={[6, 6, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}

