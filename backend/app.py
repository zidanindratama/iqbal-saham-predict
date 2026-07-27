from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import yfinance as yf
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import os, json, warnings
warnings.filterwarnings("ignore")

app  = Flask(__name__, static_folder="static", static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ═══════════════════════════════════════════════
# KONSTANTA — sesuai notebook GRU multi-fitur
# ═══════════════════════════════════════════════
STOCKS = {
    "BBNI.JK": "Bank BNI",
    "BMRI.JK": "Bank Mandiri",
    "BNGA.JK": "Bank CIMB Niaga",
}
LOOKBACK   = 60
FEATURES   = ["Close", "Volume", "RSI", "USD_IDR"]
N_FEATURES = len(FEATURES)
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR  = os.path.join(BASE_DIR, "models")

# ═══════════════════════════════════════════════
# LOAD SCALER CONFIG dari JSON
# ═══════════════════════════════════════════════
def load_scaler_from_config(config):
    """Rekonstruksi MinMaxScaler dari config JSON."""
    sc = MinMaxScaler(feature_range=(0, 1))
    sc.data_min_      = np.array(config["data_min_"])
    sc.data_max_      = np.array(config["data_max_"])
    sc.scale_         = np.array(config["scale_"])
    sc.data_range_    = sc.data_max_ - sc.data_min_
    sc.min_           = 0 - sc.data_min_ * sc.scale_   # ← yang kurang
    sc.n_features_in_ = len(config["features"])
    sc.n_samples_seen_ = 1
    return sc

scaler_config_path = os.path.join(MODEL_DIR, "scaler_config.json")
SCALERS = {}
if os.path.exists(scaler_config_path):
    with open(scaler_config_path, "r") as f:
        scaler_raw = json.load(f)
    for nama, cfg in scaler_raw.items():
        SCALERS[nama] = load_scaler_from_config(cfg)
    print(f"✅ Scaler config dimuat untuk: {list(SCALERS.keys())}")
else:
    print("⚠️  scaler_config.json tidak ditemukan!")

# ═══════════════════════════════════════════════
# ARSITEKTUR GRU — sama persis dengan notebook
# ═══════════════════════════════════════════════
try:
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import GRU, Dense, Dropout, Input
except ImportError:
    from keras.models import Sequential
    from keras.layers import GRU, Dense, Dropout, Input

def buat_model_gru():
    model = Sequential([
        Input(shape=(LOOKBACK, N_FEATURES)),
        GRU(128, return_sequences=True),
        Dropout(0.2),
        GRU(64, return_sequences=True),
        Dropout(0.2),
        GRU(32, return_sequences=False),
        Dropout(0.2),
        Dense(1)
    ])
    model.compile(optimizer="adam", loss="mean_squared_error")
    return model

# ═══════════════════════════════════════════════
# LOAD MODEL GRU
# Format: gru_BBNI.h5, gru_BMRI.h5, gru_BNGA.h5
# ═══════════════════════════════════════════════
MODELS = {}
for kode in STOCKS:
    nama = kode.replace(".JK", "")
    path = os.path.join(MODEL_DIR, f"gru_{nama}.h5")
    if os.path.exists(path):
        try:
            m = buat_model_gru()
            m.load_weights(path)
            MODELS[kode] = m
            print(f"✅ GRU {kode} berhasil dimuat")
        except Exception as e:
            print(f"❌ GRU {kode} gagal: {e}")
    else:
        print(f"⚠️  GRU {kode} tidak ditemukan")

# ═══════════════════════════════════════════════
# EVAL DATA — dari hasil_evaluasi_final.csv
# ═══════════════════════════════════════════════
EVAL_DATA = {
    "BBNI.JK": {
        7 : {"mae": 144.39, "rmse": 201.96, "mape": 3.84},
        14: {"mae": 183.13, "rmse": 245.76, "mape": 4.87},
        30: {"mae": 224.10, "rmse": 285.70, "mape": 5.94},
    },
    "BMRI.JK": {
        7 : {"mae": 156.80, "rmse": 193.48, "mape": 3.68},
        14: {"mae": 202.55, "rmse": 251.05, "mape": 4.78},
        30: {"mae": 336.28, "rmse": 398.02, "mape": 7.96},
    },
    "BNGA.JK": {
        7 : {"mae":  36.90, "rmse":  51.48, "mape": 2.30},
        14: {"mae":  50.90, "rmse":  72.44, "mape": 3.17},
        30: {"mae":  63.89, "rmse":  92.81, "mape": 3.98},
    },
}

# ═══════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════

def hitung_rsi(close_series, period=14):
    """Hitung RSI manual — tanpa pandas_ta."""
    delta    = close_series.diff()
    gain     = delta.where(delta > 0, 0.0)
    loss     = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs       = avg_gain / avg_loss
    rsi      = 100 - (100 / (1 + rs))
    return rsi

def ambil_data_multifeature(kode, start="2021-06-01", end="2026-06-30"):
    """
    Ambil data multi-fitur:
    Close, Volume, RSI(14), Kurs USD/IDR
    """
    # Data saham
    raw = yf.download(kode, start=start, end=end,
                      auto_adjust=True, progress=False, threads=False)
    if raw.empty:
        raise ValueError(f"Data {kode} kosong!")

    df = raw[["Close", "Volume"]].copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df.columns = ["Close", "Volume"]
    df.index   = pd.to_datetime(df.index).tz_localize(None)

    # Hitung RSI
    df["RSI"] = hitung_rsi(df["Close"], 14)

    # Download kurs USD/IDR
    try:
        usd = yf.download("USDIDR=X", start=start, end=end,
                          auto_adjust=True, progress=False, threads=False)
        usd_close = usd["Close"]
        if isinstance(usd_close, pd.DataFrame):
            usd_close = usd_close.iloc[:, 0]
        usd_df = pd.DataFrame({"USD_IDR": usd_close})
        usd_df.index = pd.to_datetime(usd_df.index).tz_localize(None)
        df = df.join(usd_df, how="left")
        df["USD_IDR"] = df["USD_IDR"].ffill().bfill()
    except:
        df["USD_IDR"] = 15800.0

    df = df.dropna()
    return df

def prediksi_iteratif_gru(model, last_sequence, scaler, n_steps):
    """
    Prediksi iteratif GRU multi-fitur:
    Hanya Close (kolom 0) yang diupdate,
    fitur lain dipertahankan dari nilai terakhir.
    """
    seq   = last_sequence.copy()
    preds = []

    for _ in range(n_steps):
        x    = seq.reshape(1, LOOKBACK, N_FEATURES)
        pred = model.predict(x, verbose=0)[0, 0]
        preds.append(pred)

        new_row    = seq[-1].copy()
        new_row[0] = pred
        seq        = np.vstack([seq[1:], new_row])

    # Invers transformasi — hanya kolom Close
    dummy       = np.zeros((len(preds), N_FEATURES))
    dummy[:, 0] = preds
    return scaler.inverse_transform(dummy)[:, 0]

def tentukan_sinyal(harga_kini, pred_list):
    pct = ((pred_list[-1] - harga_kini) / harga_kini) * 100
    if   pct >  3: return {"label": "BULLISH KUAT", "icon": "📈", "pct": round(pct, 2)}
    elif pct >  0: return {"label": "BULLISH",      "icon": "📈", "pct": round(pct, 2)}
    elif pct > -3: return {"label": "SIDEWAYS",     "icon": "➡️",  "pct": round(pct, 2)}
    else:          return {"label": "BEARISH",      "icon": "📉", "pct": round(pct, 2)}

# ═══════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════

@app.route("/", methods=["GET"])
def serve_frontend():
    index_path = os.path.join(app.static_folder, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({
        "app"    : "SahamPredict — GRU Multi-Fitur",
        "versi"  : "3.0",
        "model"  : "GRU (128→64→32)",
        "fitur"  : FEATURES,
        "status" : {k: "siap" if k in MODELS else "belum_ada" for k in STOCKS},
    })


@app.route("/api/info", methods=["GET"])
def info():
    return jsonify({
        "app"    : "SahamPredict — GRU Multi-Fitur",
        "versi"  : "3.0",
        "model"  : "GRU (128→64→32)",
        "fitur"  : FEATURES,
        "status" : {k: "siap" if k in MODELS else "belum_ada" for k in STOCKS},
    })


@app.route("/api/harga-sekarang", methods=["GET"])
def harga_sekarang():
    """Harga terkini + perubahan harian dari Yahoo Finance."""
    hasil = {}
    for kode, nama in STOCKS.items():
        try:
            raw = yf.download(kode, period="5d",
                              auto_adjust=True, progress=False, threads=False)
            if raw.empty:
                raise ValueError("Data kosong")

            close = raw["Close"]
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]

            close = close.dropna()
            if len(close) < 2:
                raise ValueError("Data kurang dari 2 hari")

            harga_kini    = float(close.iloc[-1])
            harga_kemarin = float(close.iloc[-2])
            perubahan     = harga_kini - harga_kemarin
            persen        = (perubahan / harga_kemarin) * 100

            hasil[kode] = {
                "nama"         : nama,
                "hargaSekarang": round(harga_kini, 0),
                "perubahanHari": round(perubahan, 0),
                "persenHari"   : round(persen, 2),
            }
        except Exception as e:
            hasil[kode] = {"nama": nama, "error": str(e)}
    return jsonify(hasil)


@app.route("/api/prediksi", methods=["GET"])
def prediksi():
    """
    Simulasi prediksi GRU multi-fitur.
    Params:
    - kode     : BBNI.JK / BMRI.JK / BNGA.JK
    - hari     : 7 / 14 / 30
    - start    : tanggal mulai data (YYYY-MM-DD)
    - end      : tanggal akhir data (YYYY-MM-DD)
    - historis : jumlah hari historis di grafik (default 9999=semua)
    """
    kode     = request.args.get("kode",    "BBNI.JK")
    hari     = int(request.args.get("hari",     7))
    start    = request.args.get("start",   "2021-06-01")
    end      = request.args.get("end",     "2026-06-30")
    historis = int(request.args.get("historis", 9999))

    if kode not in STOCKS:
        return jsonify({"error": "Kode tidak valid"}), 400
    if kode not in MODELS:
        return jsonify({"error": f"Model GRU {kode} belum tersedia"}), 503

    try:
        nama_bank = kode.replace(".JK", "")
        scaler    = SCALERS.get(nama_bank)
        if scaler is None:
            return jsonify({"error": "Scaler tidak ditemukan"}), 503

        # Ambil data multi-fitur
        df = ambil_data_multifeature(kode, start, end)
        if len(df) < LOOKBACK + hari:
            return jsonify({"error": f"Data terlalu sedikit ({len(df)} hari)"}), 400

        harga_kini   = float(df["Close"].iloc[-1])
        data_scaled  = scaler.transform(df[FEATURES].values)
        last_seq     = data_scaled[-LOOKBACK:, :]

        # Prediksi iteratif
        pred_values  = prediksi_iteratif_gru(MODELS[kode], last_seq, scaler, hari)
        pred_rounded = [round(float(p), 0) for p in pred_values]

        # Tanggal prediksi (hari kerja)
        last_date    = pd.Timestamp(df.index[-1])
        tgl_prediksi = pd.bdate_range(last_date + pd.Timedelta(days=1), periods=hari)
        prediksi_list = [
            {"tanggal": str(t.date()), "harga": round(float(p), 0)}
            for t, p in zip(tgl_prediksi, pred_values)
        ]

        # Data historis untuk grafik — sekarang mencakup Close, Volume, RSI, USD_IDR
        if historis >= 9999:
            hist_df = df[["Close", "Volume", "RSI", "USD_IDR"]].copy()
        else:
            hist_df = df[["Close", "Volume", "RSI", "USD_IDR"]].tail(historis).copy()

        hist_df.index = hist_df.index.astype(str)
        historis_list = [
            {
                "tanggal": str(idx)[:10],
                "harga"  : round(float(row["Close"]), 0),
                "volume" : round(float(row["Volume"]), 0),
                "rsi"    : round(float(row["RSI"]), 2) if pd.notna(row["RSI"]) else None,
                "usdIdr" : round(float(row["USD_IDR"]), 2),
            }
            for idx, row in hist_df.iterrows()
        ]

        # Nilai fitur terkini (baris terakhir dataset), untuk kartu ringkasan
        fitur_kini = {
            "volume": round(float(df["Volume"].iloc[-1]), 0),
            "rsi"   : round(float(df["RSI"].iloc[-1]), 2),
            "usdIdr": round(float(df["USD_IDR"].iloc[-1]), 2),
        }

        # Sinyal
        sinyal = tentukan_sinyal(harga_kini, pred_rounded)

        # Metrik evaluasi untuk horizon ini
        eval_h = EVAL_DATA.get(kode, {}).get(hari, {})

        return jsonify({
            "kode"         : kode,
            "nama"         : STOCKS[kode],
            "model"        : "GRU",
            "fitur"        : FEATURES,
            "hari"         : hari,
            "periodeStart" : start,
            "periodeEnd"   : end,
            "totalData"    : len(df),
            "hargaSekarang": round(harga_kini, 0),
            "fiturKini"    : fitur_kini,
            "prediksi"     : pred_rounded,
            "prediksiList" : prediksi_list,
            "historis"     : historis_list,
            "sinyal"       : sinyal,
            "evaluasi"     : eval_h,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluasi", methods=["GET"])
def evaluasi():
    """Hasil evaluasi GRU per bank per horizon."""
    kode = request.args.get("kode", "BBNI.JK")
    if kode not in EVAL_DATA:
        return jsonify({"error": "Kode tidak valid"}), 400
    return jsonify({
        "kode"  : kode,
        "nama"  : STOCKS[kode],
        "model" : "GRU",
        "fitur" : FEATURES,
        "hasil" : EVAL_DATA[kode],
    })


@app.route("/api/status-model", methods=["GET"])
def status_model():
    return jsonify({k: {
        "GRU"   : "siap" if k in MODELS else "belum_ada",
        "scaler": "siap" if k.replace(".JK", "") in SCALERS else "belum_ada",
    } for k in STOCKS})


# ═══════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════
if __name__ == "__main__":
    print("\n" + "="*55)
    print("   📈  SahamPredict v3.0 — GRU Multi-Fitur")
    print("   🔮  Dashboard Simulasi Prediksi Saham")
    print("   📡  Running at http://localhost:5000")
    print("="*55)
    print(f"\n📋 Fitur Input  : {FEATURES}")
    print(f"📋 Lookback     : {LOOKBACK} hari")
    print(f"📋 Arsitektur   : GRU 128→64→32 + Dropout 20%")
    print("\n📋 Status Model:")
    for kode, nama in STOCKS.items():
        gru_ok  = "✅ Siap" if kode in MODELS else "⚠️  Belum ada"
        sc_ok   = "✅ Siap" if kode.replace('.JK','') in SCALERS else "⚠️  Belum ada"
        print(f"   {nama} ({kode})")
        print(f"      GRU    : {gru_ok}")
        print(f"      Scaler : {sc_ok}")
    print("\n" + "="*55 + "\n")
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
