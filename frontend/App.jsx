import React, { useState, useEffect } from "react"
import { Client } from "@gradio/client"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine
} from "recharts"

// ═══════════════════════════════════════════════
// GRADIO API
// Production: isi VITE_GRADIO_SPACE di Vercel jika Space ID berbeda.
// ═══════════════════════════════════════════════
const GRADIO_SPACE = import.meta.env.VITE_GRADIO_SPACE || "zidanindratama/iqbal-saham-predict"
let gradioClientPromise = null

const getGradioClient = () => {
  if (!gradioClientPromise) {
    gradioClientPromise = Client.connect(GRADIO_SPACE)
  }
  return gradioClientPromise
}

const callGradio = async (endpoint, payload = []) => {
  const client = await getGradioClient()
  const result = await client.predict(endpoint, payload)
  const data = result?.data?.[0] ?? result
  if (data?.error) throw new Error(data.error)
  return data
}

// ═══════════════════════════════════════════════
// KONSTANTA
// ═══════════════════════════════════════════════
const BANKS = {
  "BBNI.JK": { name: "Bank A", short: "A", color: "#2196F3" },
  "BMRI.JK": { name: "Bank B", short: "B", color: "#4CAF50" },
  "BNGA.JK": { name: "Bank C", short: "C", color: "#FF5722" },
}
const HORIZONS = [7, 14, 30]

// ═══════════════════════════════════════════════
// STYLE HELPERS
// ═══════════════════════════════════════════════
const card  = { background: "#111827", border: "1px solid #1e2d4a", borderRadius: 12, padding: 20 }
const mono  = { fontFamily: "'Space Mono', monospace" }
const lbl   = { fontSize: 10, color: "#475569", fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em", marginBottom: 6 }

// ═══════════════════════════════════════════════
// KOMPONEN KECIL
// ═══════════════════════════════════════════════
const Badge = ({ children, color = "#3b82f6" }) => (
  <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: color + "20", color, border: `1px solid ${color}40`, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{children}</span>
)

const BtnGroup = ({ options, active, onChange, fmt }) => (
  <div style={{ display: "flex", background: "#0f1528", borderRadius: 8, padding: 3, border: "1px solid #1e2d4a", gap: 2 }}>
    {options.map(o => (
      <button key={o} onClick={() => onChange(o)} style={{
        padding: "6px 14px", borderRadius: 6, border: "none",
        background: active === o ? "#3b82f6" : "transparent",
        color: active === o ? "white" : "#94a3b8",
        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
      }}>{fmt ? fmt(o) : o}</button>
    ))}
  </div>
)

const Spinner = ({ text = "Memuat..." }) => (
  <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
    <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
    <div style={{ fontSize: 13, ...mono }}>{text}</div>
  </div>
)

const ErrBox = ({ msg }) => (
  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#ef4444" }}>❌ {msg}</div>
)

// ═══════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════
const StatCard = ({ kode, dataHarga }) => {
  const bank = BANKS[kode]
  const d    = dataHarga?.[kode]
  return (
    <div style={{ ...card, position: "relative", overflow: "hidden", padding: 16 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: bank.color }} />
      <div style={{ fontSize: 10, color: "#94a3b8", ...mono, marginBottom: 8 }}>🏦 {bank.name.toUpperCase()}</div>
      {d?.hargaSekarang ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: "#e2e8f0" }}>
            Rp {d.hargaSekarang.toLocaleString("id-ID")}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: d.perubahanHari >= 0 ? "#10b981" : "#ef4444" }}>
            {d.perubahanHari >= 0 ? "▲" : "▼"} {Math.abs(d.perubahanHari).toLocaleString("id-ID")} ({Math.abs(d.persenHari)}%)
          </div>
        </>
      ) : <div style={{ fontSize: 14, color: "#475569", ...mono }}>Memuat...</div>}
      <div style={{ fontSize: 10, color: "#475569", marginTop: 6, ...mono }}>{kode}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// SINYAL CARD
// ═══════════════════════════════════════════════
const SinyalCard = ({ kode, sinyal, eval_h }) => {
  const bank = BANKS[kode]
  const s    = sinyal?.[kode]
  if (!s) return null
  const clr = { "BULLISH KUAT": "#10b981", "BULLISH": "#10b981", "SIDEWAYS": "#f59e0b", "BEARISH": "#ef4444" }[s.label] || "#94a3b8"
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", ...mono, marginBottom: 8 }}>🏦 {bank.name.toUpperCase()}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: clr, marginBottom: 6 }}>{s.icon} {s.label}</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>
        Prediksi {s.pct >= 0 ? "naik" : "turun"} ~{Math.abs(s.pct).toFixed(1)}%
      </div>
      {eval_h && (
        <div style={{ fontSize: 10, color: "#475569", marginTop: 6, ...mono }}>
          MAPE: {eval_h.mape}% | MAE: {eval_h.mae}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// HALAMAN PREDIKSI
// ═══════════════════════════════════════════════
const HalamanPrediksi = () => {
  const [horizon,   setHorizon]   = useState(7)
  const [loading,   setLoading]   = useState(false)
  const [dataHarga, setDataHarga] = useState(null)
  const [hasil,     setHasil]     = useState(null)
  const [error,     setError]     = useState(null)
  const [startDate, setStartDate] = useState("2021-06-01")
  const [endDate,   setEndDate]   = useState("2026-06-30")
  const [filterMsg, setFilterMsg] = useState("")

  useEffect(() => {
    callGradio("/harga_sekarang").then(setDataHarga).catch(() => {})
  }, [])

  const handleApplyFilter = () => {
    const diff = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    if (diff < 180) {
      setFilterMsg("⚠️ Rentang minimal 6 bulan!")
      return
    }
    setFilterMsg(`✅ Filter diterapkan: ${startDate} s/d ${endDate}`)
    setHasil(null)
  }

  const handlePrediksi = async () => {
    const diff = Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    if (diff < 180) {
      setError("⚠️ Rentang tanggal minimal 6 bulan!")
      return
    }
    setLoading(true); setError(null); setHasil(null)
    try {
      const responses = await Promise.all(
        Object.keys(BANKS).map(kode =>
          callGradio("/prediksi", [kode, horizon, startDate, endDate, 9999])
        )
      )
      const combined = {}
      responses.forEach(data => { combined[data.kode] = data })
      setHasil(combined)
    } catch (e) {
      setError(`Gagal mengambil prediksi dari Hugging Face Space. ${e.message || ""}`)
    } finally {
      setLoading(false)
    }
  }

  const sinyalSemua = hasil
    ? Object.fromEntries(Object.keys(BANKS).map(k => [k, hasil[k]?.sinyal]))
    : null

  const saranTeks = () => {
    if (!sinyalSemua) return ""
    const pos = [], neg = []
    Object.entries(sinyalSemua).forEach(([k, s]) => {
      if (!s) return
      s.label.includes("BULLISH") ? pos.push(BANKS[k].name) : neg.push(BANKS[k].name)
    })
    let t = ""
    if (pos.length) t += `${pos.join(" dan ")} menunjukkan sinyal positif dalam ${horizon} hari ke depan, dapat dipertimbangkan untuk analisis lebih lanjut. `
    if (neg.length) t += `${neg.join(" dan ")} diprediksi sideways atau turun, disarankan menahan posisi.`
    return t
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: "#e2e8f0" }}>Dashboard Simulasi Prediksi Saham Bank</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
          Model GRU · Fitur: Closing Price, Volume, RSI(14), Kurs USD/IDR · Bank A · Bank B · Bank C
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {Object.keys(BANKS).map(k => <StatCard key={k} kode={k} dataHarga={dataHarga} />)}
      </div>

      {/* Filter Tanggal */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ ...lbl }}>DARI</div>
            <input type="date" value={startDate} min="2021-06-01" max="2026-06-30"
              onChange={e => setStartDate(e.target.value)}
              style={{ width: "100%", background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8, padding: "7px 10px", color: "#e2e8f0", fontSize: 12, fontFamily: "'Space Mono', monospace" }}
            />
          </div>
          <div style={{ color: "#475569", paddingBottom: 8 }}>—</div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ ...lbl }}>SAMPAI</div>
            <input type="date" value={endDate} min="2021-06-01" max="2026-06-30"
              onChange={e => setEndDate(e.target.value)}
              style={{ width: "100%", background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8, padding: "7px 10px", color: "#e2e8f0", fontSize: 12, fontFamily: "'Space Mono', monospace" }}
            />
          </div>
          <button onClick={handleApplyFilter} style={{
            padding: "8px 16px", borderRadius: 8, background: "#3b82f620",
            color: "#3b82f6", border: "1px solid #3b82f640",
            fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}>Terapkan</button>
          <div style={{ fontSize: 10, color: "#475569", ...mono, alignSelf: "flex-end", paddingBottom: 4 }}>
            Data: 1 Jun 2021 → 30 Jun 2026
          </div>
        </div>
        {filterMsg && <div style={{ fontSize: 11, color: filterMsg.startsWith("✅") ? "#10b981" : "#f59e0b", marginTop: 8, ...mono }}>{filterMsg}</div>}
      </div>

      {/* Controls */}
      <div style={{ ...card, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div style={lbl}>HORIZON PREDIKSI</div>
          <BtnGroup options={HORIZONS} active={horizon} onChange={setHorizon} fmt={v => `${v} Hari`} />
        </div>
        <div style={{ fontSize: 10, color: "#475569", ...mono, alignSelf: "flex-end", paddingBottom: 4 }}>
          Model: GRU 128→64→32 | Fitur: Close + Volume + RSI + USD/IDR
        </div>
        <button onClick={handlePrediksi} disabled={loading} style={{
          padding: "9px 28px", borderRadius: 8, border: "none",
          background: loading ? "#1e2d4a" : "#3b82f6", color: "white",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer", marginLeft: "auto"
        }}>{loading ? "⏳ Memproses..." : "🔮 Prediksi Sekarang"}</button>
      </div>

      {error   && <ErrBox msg={error} />}
      {loading && <Spinner text="Model GRU sedang memproses prediksi..." />}

      {!loading && hasil && (
        <>
          {/* Grafik per bank */}
          {Object.entries(BANKS).map(([kode, bank]) => {
            const d = hasil[kode]
            if (!d) return null

            const chartData = [
              ...(d.historis || []).map((h, i) => ({ tanggal: h.tanggal.slice(2), aktual: h.harga, prediksi: null })),
              ...(d.prediksiList || []).map((p, i) => ({ tanggal: p.tanggal.slice(2), aktual: null, prediksi: p.harga })),
            ]

            return (
              <div key={kode} style={{ ...card, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: bank.color }}>
                      📈 {bank.name} ({bank.short})
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", ...mono, marginTop: 2 }}>
                      Historis + {d.hari} hari prediksi · GRU Multi-Fitur
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {d.evaluasi && <Badge color="#8b5cf6">MAPE: {d.evaluasi.mape}%</Badge>}
                    <Badge color={bank.color}>{kode}</Badge>
                  </div>
                </div>

                {d.fiturKini && (
                  <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "#94a3b8", ...mono }}>
                    <span>RSI(14): <strong style={{ color: d.fiturKini.rsi > 70 ? "#ef4444" : d.fiturKini.rsi < 30 ? "#10b981" : "#e2e8f0" }}>{d.fiturKini.rsi}</strong></span>
                    <span>Volume: <strong style={{ color: "#e2e8f0" }}>{d.fiturKini.volume?.toLocaleString("id-ID")}</strong></span>
                    <span>Kurs USD/IDR: <strong style={{ color: "#e2e8f0" }}>Rp {d.fiturKini.usdIdr?.toLocaleString("id-ID")}</strong></span>
                  </div>
                )}

                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                    <XAxis dataKey="tanggal" tick={{ fill: "#475569", fontSize: 9 }} axisLine={{ stroke: "#1e2d4a" }}
                      interval={Math.floor(chartData.length / 6)} />
                    <YAxis tick={{ fill: "#475569", fontSize: 9 }} axisLine={{ stroke: "#1e2d4a" }}
                      domain={["auto", "auto"]} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
                    <Tooltip contentStyle={{ background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8 }}
                      formatter={(v, n) => [`Rp ${v?.toLocaleString("id-ID")}`, n === "aktual" ? "Historis" : `Prediksi GRU H+${d.hari}`]} />
                    <Legend wrapperStyle={{ fontSize: 11 }}
                      formatter={v => v === "aktual" ? "Historis" : `Prediksi GRU H+${d.hari}`} />
                    <Line type="monotone" dataKey="aktual" stroke={bank.color} strokeWidth={2} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="prediksi" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>

                {/* Grafik fitur tambahan: Volume, RSI, Kurs USD/IDR */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
                  {/* Volume */}
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", ...mono, marginBottom: 6 }}>📦 VOLUME TRANSAKSI</div>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={d.historis || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis dataKey="tanggal" tick={{ fill: "#475569", fontSize: 8 }} axisLine={{ stroke: "#1e2d4a" }}
                          interval={Math.floor((d.historis?.length || 1) / 4)} tickFormatter={t => t.slice(2)} />
                        <YAxis tick={{ fill: "#475569", fontSize: 8 }} axisLine={{ stroke: "#1e2d4a" }}
                          tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}Jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}rb` : v} />
                        <Tooltip contentStyle={{ background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8, fontSize: 11 }}
                          formatter={v => [v?.toLocaleString("id-ID"), "Volume"]} />
                        <Bar dataKey="volume" fill="#64748b" radius={[2,2,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* RSI */}
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", ...mono, marginBottom: 6 }}>📈 RSI (14)</div>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={d.historis || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis dataKey="tanggal" tick={{ fill: "#475569", fontSize: 8 }} axisLine={{ stroke: "#1e2d4a" }}
                          interval={Math.floor((d.historis?.length || 1) / 4)} tickFormatter={t => t.slice(2)} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 8 }} axisLine={{ stroke: "#1e2d4a" }} />
                        <Tooltip contentStyle={{ background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8, fontSize: 11 }}
                          formatter={v => [v, "RSI"]} />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
                        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
                        <Line type="monotone" dataKey="rsi" stroke="#a855f7" strokeWidth={1.5} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Kurs USD/IDR */}
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", ...mono, marginBottom: 6 }}>💵 KURS USD/IDR</div>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={d.historis || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <XAxis dataKey="tanggal" tick={{ fill: "#475569", fontSize: 8 }} axisLine={{ stroke: "#1e2d4a" }}
                          interval={Math.floor((d.historis?.length || 1) / 4)} tickFormatter={t => t.slice(2)} />
                        <YAxis domain={["auto", "auto"]} tick={{ fill: "#475569", fontSize: 8 }} axisLine={{ stroke: "#1e2d4a" }} />
                        <Tooltip contentStyle={{ background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8, fontSize: 11 }}
                          formatter={v => [`Rp ${v?.toLocaleString("id-ID")}`, "USD/IDR"]} />
                        <Line type="monotone" dataKey="usdIdr" stroke="#facc15" strokeWidth={1.5} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Tabel Prediksi */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 }}>📋 Tabel Simulasi Prediksi Harga</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["TANGGAL", ...Object.values(BANKS).map(b => b.name.toUpperCase())].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: "#475569", ...mono, borderBottom: "1px solid #1e2d4a" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: horizon }, (_, i) => {
                    // Ambil tanggal dari bank pertama yang datanya tersedia (kalender bursa sama untuk semua bank)
                    const tglRaw = Object.keys(BANKS)
                      .map(kode => hasil[kode]?.prediksiList?.[i]?.tanggal)
                      .find(Boolean)
                    const tglFormatted = tglRaw
                      ? new Date(tglRaw).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                      : `Hari ke-${i + 1}`

                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(30,45,74,0.4)" }}>
                        <td style={{ padding: "10px 14px", color: "#475569", ...mono, fontSize: 11 }}>
                          {tglFormatted}
                        </td>
                        {Object.keys(BANKS).map(kode => (
                          <td key={kode} style={{ padding: "10px 14px", color: "#e2e8f0" }}>
                            Rp {(hasil[kode]?.prediksi?.[i] || 0).toLocaleString("id-ID")}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sinyal */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            {Object.keys(BANKS).map(k => (
              <SinyalCard key={k} kode={k} sinyal={sinyalSemua} eval_h={hasil[k]?.evaluasi} />
            ))}
          </div>

          {/* Saran */}
          {saranTeks() && (
            <div style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", marginBottom: 8, ...mono }}>💡 INTERPRETASI SIMULASI</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{saranTeks()}</div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#f59e0b" }}>
            ⚠️ Dashboard ini merupakan <strong>prototipe simulasi prediksi</strong> berbasis model GRU untuk keperluan penelitian.
            Data harga berasal dari Yahoo Finance. <strong>Bukan merupakan rekomendasi investasi resmi.</strong>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// HALAMAN RISET
// ═══════════════════════════════════════════════
const HalamanRiset = () => {
  const [evalData, setEvalData] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all(Object.keys(BANKS).map(k =>
      callGradio("/evaluasi", [k]).then(data => ({ kode: k, data }))
    )).then(results => {
      const combined = {}
      results.forEach(({ kode, data }) => { combined[kode] = data })
      setEvalData(combined)
    }).finally(() => setLoading(false))
  }, [])

  // Bar chart — MAPE per horizon per bank
  const barData = evalData ? HORIZONS.map(h => ({
    name: `H+${h}`,
    bankA: evalData["BBNI.JK"]?.hasil?.[h]?.mape || 0,
    bankB: evalData["BMRI.JK"]?.hasil?.[h]?.mape || 0,
    bankC: evalData["BNGA.JK"]?.hasil?.[h]?.mape || 0,
  })) : []

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: "#e2e8f0" }}>Evaluasi Model GRU</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
          MAE · RMSE · MAPE · Multi-Horizon (7/14/30 hari) · Bank A · Bank B · Bank C
        </div>
      </div>

      {loading && <Spinner />}

      {!loading && evalData && (
        <>
          {/* Info Model */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", ...mono, marginBottom: 12 }}>📋 KONFIGURASI MODEL</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {[
                ["Model", "GRU (Gated Recurrent Unit)"],
                ["Arsitektur", "3-layer: 128 → 64 → 32"],
                ["Dropout", "20% per layer"],
                ["Optimizer", "Adam"],
                ["Lookback", "60 hari"],
                ["Fitur Input", "Close, Volume, RSI(14), USD/IDR"],
                ["Split Data", "80% Train / 20% Test"],
                ["Periode", "1 Jun 2021 – 30 Jun 2026"],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "#0f1528", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: "#475569", ...mono, marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Chart MAPE */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 }}>📊 Perbandingan MAPE per Horizon & Bank</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#1e2d4a" }} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={{ stroke: "#1e2d4a" }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: "#0f1528", border: "1px solid #1e2d4a", borderRadius: 8 }}
                  formatter={v => [`${v.toFixed(2)}%`]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="bankA" name="Bank A" fill="#2196F3" radius={[4,4,0,0]} />
                <Bar dataKey="bankB" name="Bank B" fill="#4CAF50" radius={[4,4,0,0]} />
                <Bar dataKey="bankC" name="Bank C" fill="#FF5722" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabel Evaluasi per Bank */}
          {Object.entries(BANKS).map(([kode, bank]) => {
            const d = evalData[kode]
            if (!d?.hasil) return null
            return (
              <div key={kode} style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e2d4a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: bank.color }}>🏦 {bank.name}</div>
                    <div style={{ fontSize: 11, color: "#475569", ...mono, marginTop: 2 }}>{kode} · GRU Multi-Fitur · Walk-Forward Validation</div>
                  </div>
                  <Badge color={bank.color}>{bank.short}</Badge>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["HORIZON", "MAE (Rp)", "RMSE (Rp)", "MAPE (%)", "AKURASI"].map(h => (
                        <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 10, color: "#475569", ...mono, borderBottom: "1px solid #1e2d4a", background: "rgba(255,255,255,0.01)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HORIZONS.map((h, i) => {
                      const ev   = d.hasil[h]
                      if (!ev) return null
                      const clr  = h === 7 ? "#10b981" : h === 14 ? "#f59e0b" : "#ef4444"
                      return (
                        <tr key={h} style={{ borderBottom: "1px solid rgba(30,45,74,0.4)" }}>
                          <td style={{ padding: "12px 20px", color: clr, fontWeight: 600, ...mono, fontSize: 13 }}>H+{h} hari</td>
                          <td style={{ padding: "12px 20px", ...mono, fontSize: 12, color: "#94a3b8" }}>{ev.mae.toLocaleString()}</td>
                          <td style={{ padding: "12px 20px", ...mono, fontSize: 12, color: "#94a3b8" }}>{ev.rmse.toLocaleString()}</td>
                          <td style={{ padding: "12px 20px", ...mono, fontSize: 12, color: clr, fontWeight: 600 }}>{ev.mape}%</td>
                          <td style={{ padding: "12px 20px", ...mono, fontSize: 12, color: "#10b981" }}>{(100 - ev.mape).toFixed(2)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}

          {/* Kesimpulan */}
          <div style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12, padding: "16px 20px", marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", marginBottom: 8, ...mono }}>📝 KESIMPULAN EVALUASI</div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
              Model GRU dengan fitur multi-variabel (Closing Price, Volume, RSI, dan Kurs USD/IDR) berhasil memprediksi harga saham perbankan Indonesia
              dengan MAPE terbaik pada Bank C (H+7: 2.30%). Secara umum, akurasi prediksi menurun seiring bertambahnya horizon prediksi,
              yang merupakan karakteristik umum model time series. Evaluasi menggunakan metode Walk-Forward Validation dengan Rolling Origin
              untuk memastikan hasil yang representatif terhadap kondisi pasar nyata.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// HALAMAN TENTANG
// ═══════════════════════════════════════════════
const HalamanTentang = () => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: "#e2e8f0" }}>Tentang Aplikasi</div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Dashboard Simulasi Prediksi Harga Saham Perbankan Indonesia</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {[
        { title: "DETAIL PENELITIAN", color: "#3b82f6", items: [
          ["Objek", "Bank A, Bank B, dan Bank C"],
          ["Periode Data", "1 Juni 2021 – 30 Juni 2026"],
          ["Metodologi", "CRISP-DM + Prototyping"],
          ["Metrik", "MAE, RMSE, MAPE"],
        ]},
        { title: "ARSITEKTUR GRU", color: "#8b5cf6", items: [
          ["Model", "Gated Recurrent Unit (GRU)"],
          ["Layer", "3-layer: 128 → 64 → 32 unit"],
          ["Dropout", "20% setelah setiap layer"],
          ["Lookback", "60 hari (timestep)"],
          ["Optimizer", "Adam | Loss: MSE"],
        ]},
        { title: "FITUR INPUT", color: "#10b981", items: [
          ["Close", "Harga penutupan harian (target & input)"],
          ["Volume", "Volume transaksi harian"],
          ["RSI(14)", "Relative Strength Index periode 14"],
          ["USD/IDR", "Kurs Dolar AS terhadap Rupiah"],
          ["Split", "80% Train / 20% Test (kronologis)"],
        ]},
        { title: "TEKNOLOGI", color: "#f59e0b", items: [
          ["Model", "TensorFlow / Keras"],
          ["Backend", "Python Flask (port 5000)"],
          ["Frontend", "React.js + Recharts + Vite"],
          ["Data", "Yahoo Finance (yfinance)"],
          ["Evaluasi", "Walk-Forward Validation"],
        ]},
      ].map(({ title, color, items }) => (
        <div key={title} style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 16, ...mono }}>{title}</div>
          {items.map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 13 }}>
              <strong style={{ color: "#e2e8f0", minWidth: 80, flexShrink: 0 }}>{k}</strong>
              <span style={{ color: "#94a3b8" }}>{v}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ ...card, gridColumn: "span 2" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", marginBottom: 12, ...mono }}>⚠️ DISCLAIMER</div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
          Dashboard ini dikembangkan dalam rangka penelitian skripsi Program Studi Informatika sebagai <strong style={{ color: "#e2e8f0" }}>prototipe simulasi prediksi</strong>,
          bukan sebagai alat rekomendasi investasi resmi. Data harga yang ditampilkan bersumber dari Yahoo Finance
          yang bersifat untuk tujuan informasi dan tidak ditujukan untuk trading atau keputusan investasi.
          Seluruh keputusan investasi sepenuhnya menjadi tanggung jawab pengguna.
        </div>
      </div>
    </div>
  </div>
)

// ═══════════════════════════════════════════════
// APP UTAMA
// ═══════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("prediksi")
  const pages = [
    { id: "prediksi", label: "📈 Simulasi Prediksi" },
    { id: "riset",    label: "🔬 Evaluasi Model" },
    { id: "tentang",  label: "ℹ️ Tentang" },
  ]
  return (
    <div style={{ background: "#0a0e1a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", background: "rgba(10,14,26,0.97)",
        borderBottom: "1px solid #1e2d4a", position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.1em" }}>
          SAHAM<span style={{ color: "#475569" }}>PREDICT</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {pages.map(p => (
            <button key={p.id} onClick={() => setPage(p.id)} style={{
              padding: "6px 16px", borderRadius: 6, border: "none",
              background: page === p.id ? "#151c35" : "transparent",
              color: page === p.id ? "#e2e8f0" : "#94a3b8",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer",
            }}>{p.label}</button>
          ))}
        </div>
      </nav>
      <main style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
        {page === "prediksi" && <HalamanPrediksi />}
        {page === "riset"    && <HalamanRiset />}
        {page === "tentang"  && <HalamanTentang />}
      </main>
    </div>
  )
}
