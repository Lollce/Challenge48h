import { useEffect, useMemo, useState, useCallback, useRef, memo, lazy, Suspense } from 'react'

const FranceMap = lazy(() => import('./components/FranceMap'))
const LazyRegionBarChart = lazy(() =>
  import('./components/KpiCharts').then((m) => ({ default: m.RegionBarChart }))
)
const LazyParisRadarChart = lazy(() =>
  import('./components/KpiCharts').then((m) => ({ default: m.ParisRadarChart }))
)
const LazyPotentialAreaChart = lazy(() =>
  import('./components/KpiCharts').then((m) => ({ default: m.PotentialAreaChart }))
)

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

function ChartFallback({ h = 300 }) {
  return (
    <div className="flex items-center justify-center text-sm text-[#6f6759]" style={{ height: h }}>
      Chargement…
    </div>
  )
}

function fmtNum(v) {
  if (v == null || isNaN(Number(v))) return '–'
  return new Intl.NumberFormat('fr-FR').format(Number(v))
}
function fmtPct(v) {
  if (v == null || isNaN(Number(v))) return '–'
  return `${Number(v).toFixed(1)} %`
}

const MetricCard = memo(function MetricCard({ label, value, sub, accent }) {
  return (
    <article className="panel metric-card fade-up rounded-3xl p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6e6658]">
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-extrabold sm:text-4xl"
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-[#716b5e]">{sub}</p>
    </article>
  )
})

const SectionTitle = memo(function SectionTitle({ children, badge }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold text-[#1c1713]">{children}</h2>
      {badge && (
        <span className="rounded-full bg-[#efe5d4] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#6f6045]">
          {badge}
        </span>
      )}
    </div>
  )
})

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  const [regional, setRegional] = useState([])
  const [paris, setParis] = useState([])
  const [targets, setTargets] = useState([])

  const [regionSearch, setRegionSearch] = useState('')
  const [minPotential, setMinPotential] = useState(0)
  const [minLots, setMinLots] = useState(100)

  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedPotential, setDebouncedPotential] = useState(0)
  const [debouncedLots, setDebouncedLots] = useState(100)

  const debounceRef = useRef({})
  const debounce = useCallback((key, fn, delay = 150) => {
    clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(fn, delay)
  }, [])

  const handleSearch = useCallback((e) => {
    const v = e.target.value
    setRegionSearch(v)
    debounce('search', () => setDebouncedSearch(v), 200)
  }, [debounce])

  const handlePotential = useCallback((e) => {
    const v = Number(e.target.value)
    setMinPotential(v)
    debounce('potential', () => setDebouncedPotential(v))
  }, [debounce])

  const handleLots = useCallback((e) => {
    const v = Number(e.target.value)
    setMinLots(v)
    debounce('lots', () => setDebouncedLots(v))
  }, [debounce])

  const handleReset = useCallback(() => {
    setRegionSearch(''); setDebouncedSearch('')
    setMinPotential(0); setDebouncedPotential(0)
    setMinLots(100); setDebouncedLots(100)
    Object.values(debounceRef.current).forEach(clearTimeout)
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')

    Promise.all([
      fetch(`${API_BASE}/health`),
      fetch(`${API_BASE}/kpi/regional?limit=30`),
      fetch(`${API_BASE}/kpi/paris-arrondissements`),
      fetch(`${API_BASE}/kpi/commercial-targets?limit=60`),
    ])
      .then((responses) => Promise.all(responses.map((r) => r.json())))
      .then(([h, r, p, t]) => {
        if (!live) return
        setHealth(h)
        setRegional(Array.isArray(r?.data) ? r.data : [])
        setParis(Array.isArray(p?.data) ? p.data : [])
        setTargets(Array.isArray(t?.data) ? t.data : [])
      })
      .catch((e) => {
        if (live) setError(`Erreur de chargement : ${e.message}`)
      })
      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
    }
  }, [])

  const filteredRegional = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return regional.filter((r) => {
      const name = (r.region_name || r.region_code || '').toLowerCase()
      return (
        name.includes(q) &&
        Number(r.overall_commercial_potential ?? 0) >= debouncedPotential
      )
    })
  }, [regional, debouncedSearch, debouncedPotential])

  const filteredTargets = useMemo(
    () =>
      [...targets]
        .filter((t) => Number(t.total_lots ?? 0) >= debouncedLots)
        .sort(
          (a, b) =>
            Number(a.ranking ?? 999999) - Number(b.ranking ?? 999999)
        )
        .slice(0, 12),
    [targets, debouncedLots]
  )

  const topRegion = useMemo(
    () =>
      [...regional].sort(
        (a, b) =>
          Number(b.overall_commercial_potential ?? 0) -
          Number(a.overall_commercial_potential ?? 0)
      )[0],
    [regional]
  )

  const avgPotential = useMemo(() => {
    if (!regional.length) return null
    return (
      regional.reduce(
        (s, r) => s + Number(r.overall_commercial_potential ?? 0),
        0
      ) / regional.length
    )
  }, [regional])

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-6">

        <header className="fade-up panel rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mt-2 text-4xl font-extrabold text-[#1e1915] sm:text-5xl">
                Tableau de Bord{' '}
                <span className="text-[#d76b2d]">ParkShare</span>
              </h1>
              <p className="mt-2 max-w-2xl text-[#5f584d]">
                Analyse en temps réel du potentiel commercial régional, des
                points chauds parisiens et des meilleures cibles copropriété.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-[#dccfb8] bg-[#fff7e8] px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6f5b]">
                Statut API
              </p>
              <p
                className={`mt-1 font-bold ${
                  loading
                    ? 'text-[#888]'
                    : error
                    ? 'text-[#c54242]'
                    : 'text-[#1f6d64]'
                }`}
              >
                {loading
                  ? 'Chargement…'
                  : error
                  ? '⚠ Erreur partielle'
                  : '● Connecté'}
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-[#e7b6b6] bg-[#fff2f2] px-4 py-3 text-sm text-[#8a3030]">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Copropriétés"
            value={fmtNum(health?.data_overview?.total_condominiums)}
            sub="Total dans la plateforme"
            accent="#d76b2d"
          />
          <MetricCard
            label="Régions analysées"
            value={fmtNum(
              health?.data_overview?.total_regions ?? regional.length
            )}
            sub="Instantané actuel"
            accent="#1f6d64"
          />
          <MetricCard
            label="Meilleure région"
            value={topRegion?.region_name || '–'}
            sub={
              topRegion
                ? `Potentiel : ${fmtPct(topRegion.overall_commercial_potential)}`
                : 'En attente des données'
            }
            accent="#3d3125"
          />
          <MetricCard
            label="Potentiel moyen"
            value={avgPotential == null ? '–' : fmtPct(avgPotential)}
            sub="Toutes régions confondues"
            accent="#935018"
          />
        </section>

        {/* ── Filtres ── */}
        <section className="panel fade-up rounded-3xl p-5 sm:p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6e6658]">
            Filtres
          </p>
          <div className="flex flex-wrap gap-5">
            {/* Recherche région */}
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-[#6f6657]">
                Rechercher une région
              </label>
              <input
                type="text"
                list="region-suggestions"
                value={regionSearch}
                onChange={handleSearch}
                placeholder="ex. Île-de-France…"
                className="w-full rounded-xl border border-[#ddd4bd] bg-[#fffef9] px-3 py-2 text-sm text-[#1c1713] outline-none focus:border-[#d76b2d] focus:ring-1 focus:ring-[#d76b2d]/30"
              />
              <datalist id="region-suggestions">
                {regional.map((r) => (
                  <option key={r.region_code || r.region_name} value={r.region_name || r.region_code} />
                ))}
              </datalist>
            </div>

            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-[#6f6657]">
                Potentiel minimum :{' '}
                <strong className="text-[#d76b2d]">{minPotential} %</strong>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minPotential}
                onChange={handlePotential}
                className="w-full accent-[#d76b2d]"
              />
            </div>

            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-[#6f6657]">
                Lots minimum (cibles) :{' '}
                <strong className="text-[#1f6d64]">{fmtNum(minLots)}</strong>
              </label>
              <input
                type="range"
                min={100}
                max={1500000}
                step={1000}
                value={minLots}
                onChange={handleLots}
                className="w-full accent-[#1f6d64]"
              />
            </div>

            {/* Reset */}
            <div className="flex items-end">
              <button
                onClick={handleReset}
                className="rounded-xl border border-[#ddd4bd] bg-[#fff3e0] px-4 py-2 text-sm font-medium text-[#6f5840] transition hover:bg-[#fde8c8]"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-[#8a7a6a]">
            {filteredRegional.length} région
            {filteredRegional.length > 1 ? 's' : ''} affichée
            {filteredRegional.length > 1 ? 's' : ''} ·{' '}
            {filteredTargets.length} cible
            {filteredTargets.length > 1 ? 's' : ''}
          </p>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="panel fade-up rounded-3xl p-5 sm:p-6">
            <SectionTitle
              badge={`${filteredRegional.length} région${filteredRegional.length > 1 ? 's' : ''}`}
            >
              Carte de Scoring Régional
            </SectionTitle>
            <Suspense
              fallback={
                <div className="flex h-[420px] items-center justify-center text-sm text-[#6f6759]">
                  Chargement de la carte…
                </div>
              }
            >
              <FranceMap regions={filteredRegional} />
            </Suspense>
          </div>

          <div className="panel fade-up rounded-3xl p-5 sm:p-6">
            <SectionTitle badge="Top 10">
              Classement du Potentiel Régional
            </SectionTitle>
            <Suspense fallback={<ChartFallback h={340} />}>
              <LazyRegionBarChart
                regions={filteredRegional}
                minPotential={minPotential}
              />
            </Suspense>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="panel fade-up rounded-3xl p-5 sm:p-6">
            <SectionTitle>
              Analyse Parisienne – Partage &amp; Stationnement
            </SectionTitle>
            <Suspense fallback={<ChartFallback h={300} />}>
              <LazyParisRadarChart boroughs={paris} />
            </Suspense>
          </div>

          <div className="panel fade-up rounded-3xl p-5 sm:p-6">
            <SectionTitle>Distribution du Potentiel Commercial</SectionTitle>
            <p className="mb-3 text-xs text-[#8a7a6a]">
              Régions classées du plus faible au plus fort potentiel
            </p>
            <Suspense fallback={<ChartFallback h={200} />}>
              <LazyPotentialAreaChart regions={filteredRegional} />
            </Suspense>
          </div>
        </section>

        <section className="panel fade-up rounded-3xl p-5 sm:p-6">
          <SectionTitle badge="Priorité 1">
            Meilleures Cibles Commerciales
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTargets.length === 0 && (
              <p className="col-span-3 text-sm text-[#6f6759]">
                Aucune cible disponible avec ces filtres.
              </p>
            )}
            {filteredTargets.map((t) => (
              <article
                key={t.id || t.numero_d_immatriculation}
                className="rounded-2xl border border-[#e4d9c2] bg-[#fffdf7] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-[#7f745f]">
                  Rang #{t.ranking}
                </p>
                <h3 className="mt-1 line-clamp-2 text-base font-bold text-[#1f1a16]">
                  {t.condominium_name ||
                    t.nom_d_usage_de_la_copropriete ||
                    'Copropriété sans nom'}
                </h3>
                <p className="mt-1 text-sm text-[#5c5549]">
                  {t.commune || 'Commune inconnue'}
                </p>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6a6457]">Score potentiel</span>
                    <span className="font-bold text-[#1f6d64]">
                      {fmtNum(t.potential_score)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6a6457]">Total lots</span>
                    <span className="font-bold text-[#d76b2d]">
                      {fmtNum(t.total_lots)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-[#e2d8c2] bg-[#fff9ec] px-4 py-3 text-center text-sm text-[#5a554a]">
            Chargement des données du tableau de bord…
          </div>
        )}
      </div>
    </main>
  )
}
