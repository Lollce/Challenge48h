import { useMemo, memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  AreaChart,
  Area,
} from 'recharts'

function fmt(v, suffix = '') {
  const n = Number(v)
  if (isNaN(n)) return '–'
  return `${n.toFixed(1)}${suffix}`
}

function ChartTooltip({ active, payload, label, suffix = ' %' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[#e4d9c2] bg-[#fffdf7] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-[#1c1713]">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : {fmt(p.value, suffix)}
        </p>
      ))}
    </div>
  )
}

export const RegionBarChart = memo(function RegionBarChart({ regions, minPotential = 0 }) {
  const data = useMemo(
    () =>
      [...regions]
        .filter((r) => Number(r.overall_commercial_potential ?? 0) >= minPotential)
        .sort(
          (a, b) =>
            Number(b.overall_commercial_potential ?? 0) -
            Number(a.overall_commercial_potential ?? 0)
        )
        .slice(0, 10)
        .map((r) => ({
          name: (r.region_name || r.region_code || 'N/A').slice(0, 24),
          potentiel: Number(r.overall_commercial_potential ?? 0),
        })),
    [regions, minPotential]
  )

  if (!data.length)
    return (
      <p className="py-10 text-center text-sm text-[#6f6759]">
        Aucune donnée régionale disponible.
      </p>
    )

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
      >
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1f6d64" />
            <stop offset="100%" stopColor="#d76b2d" />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#ede4cf"
          horizontal={false}
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#6f6657' }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={145}
          tick={{ fontSize: 10, fill: '#403a34' }}
        />
        <Tooltip content={<ChartTooltip suffix=" %" />} />
        <Bar
          dataKey="potentiel"
          name="Potentiel"
          fill="url(#barGrad)"
          radius={[0, 5, 5, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
})

export const ParisRadarChart = memo(function ParisRadarChart({ boroughs }) {
  const data = useMemo(
    () =>
      [...boroughs]
        .sort((a, b) => Number(a.ranking ?? 999) - Number(b.ranking ?? 999))
        .slice(0, 8)
        .map((b) => ({
          arr: `${b.arrondissement || b.arr}e`,
          Partage: Number(b.potential_for_sharing ?? 0),
          Stationnement: Number(b.parking_supply_score ?? 0),
        })),
    [boroughs]
  )

  if (!data.length)
    return (
      <p className="py-10 text-center text-sm text-[#6f6759]">
        Aucune donnée Paris disponible.
      </p>
    )

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart
        data={data}
        margin={{ top: 10, right: 24, bottom: 10, left: 24 }}
      >
        <PolarGrid stroke="#ede4cf" />
        <PolarAngleAxis dataKey="arr" tick={{ fontSize: 11, fill: '#403a34' }} />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 8, fill: '#9f9585' }}
        />
        <Radar
          name="Potentiel de partage"
          dataKey="Partage"
          stroke="#1f6d64"
          fill="#1f6d64"
          fillOpacity={0.4}
        />
        <Radar
          name="Score stationnement"
          dataKey="Stationnement"
          stroke="#d76b2d"
          fill="#d76b2d"
          fillOpacity={0.3}
        />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#403a34' }} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(1)} %`} />
      </RadarChart>
    </ResponsiveContainer>
  )
})

export const PotentialAreaChart = memo(function PotentialAreaChart({ regions }) {
  const data = useMemo(
    () =>
      [...regions]
        .sort(
          (a, b) =>
            Number(a.overall_commercial_potential ?? 0) -
            Number(b.overall_commercial_potential ?? 0)
        )
        .map((r) => ({
          name: r.region_name || r.region_code,
          potentiel: Number(r.overall_commercial_potential ?? 0),
        })),
    [regions]
  )

  if (!data.length)
    return (
      <p className="py-6 text-center text-sm text-[#6f6759]">
        Aucune donnée disponible.
      </p>
    )

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d76b2d" stopOpacity={0.65} />
            <stop offset="100%" stopColor="#d76b2d" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ede4cf" />
        <XAxis dataKey="name" hide />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: '#6f6657' }}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)} %`, 'Potentiel']}
        />
        <Area
          type="monotone"
          dataKey="potentiel"
          stroke="#d76b2d"
          fill="url(#areaGrad)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})
