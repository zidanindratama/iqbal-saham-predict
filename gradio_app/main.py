import json

import gradio as gr
import pandas as pd
import yfinance as yf

from backend.app import (
    EVAL_DATA,
    FEATURES,
    LOOKBACK,
    MODELS,
    SCALERS,
    STOCKS,
    ambil_data_multifeature,
    prediksi_iteratif_gru,
    tentukan_sinyal,
)


def harga_sekarang() -> dict:
    hasil = {}
    for kode, nama in STOCKS.items():
        try:
            raw = yf.download(kode, period="5d", auto_adjust=True, progress=False, threads=False)
            if raw.empty:
                raise ValueError("Data kosong")

            close = raw["Close"]
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]

            close = close.dropna()
            if len(close) < 2:
                raise ValueError("Data kurang dari 2 hari")

            harga_kini = float(close.iloc[-1])
            harga_kemarin = float(close.iloc[-2])
            perubahan = harga_kini - harga_kemarin
            persen = (perubahan / harga_kemarin) * 100

            hasil[kode] = {
                "nama": nama,
                "hargaSekarang": round(harga_kini, 0),
                "perubahanHari": round(perubahan, 0),
                "persenHari": round(persen, 2),
            }
        except Exception as e:
            hasil[kode] = {"nama": nama, "error": str(e)}
    return hasil


def prediksi(
    kode: str = "BBNI.JK",
    hari: int = 7,
    start: str = "2021-06-01",
    end: str = "2026-06-30",
    historis: int = 9999,
) -> dict:
    kode = str(kode)
    hari = int(hari)
    historis = int(historis)

    if kode not in STOCKS:
        return {"error": "Kode tidak valid"}
    if kode not in MODELS:
        return {"error": f"Model GRU {kode} belum tersedia"}

    try:
        nama_bank = kode.replace(".JK", "")
        scaler = SCALERS.get(nama_bank)
        if scaler is None:
            return {"error": "Scaler tidak ditemukan"}

        df = ambil_data_multifeature(kode, start, end)
        if len(df) < LOOKBACK + hari:
            return {"error": f"Data terlalu sedikit ({len(df)} hari)"}

        harga_kini = float(df["Close"].iloc[-1])
        data_scaled = scaler.transform(df[FEATURES].values)
        last_seq = data_scaled[-LOOKBACK:, :]

        pred_values = prediksi_iteratif_gru(MODELS[kode], last_seq, scaler, hari)
        pred_rounded = [round(float(p), 0) for p in pred_values]

        last_date = pd.Timestamp(df.index[-1])
        tgl_prediksi = pd.bdate_range(last_date + pd.Timedelta(days=1), periods=hari)
        prediksi_list = [
            {"tanggal": str(t.date()), "harga": round(float(p), 0)}
            for t, p in zip(tgl_prediksi, pred_values)
        ]

        hist_df = df[["Close", "Volume", "RSI", "USD_IDR"]].copy()
        if historis < 9999:
            hist_df = hist_df.tail(historis).copy()

        hist_df.index = hist_df.index.astype(str)
        historis_list = [
            {
                "tanggal": str(idx)[:10],
                "harga": round(float(row["Close"]), 0),
                "volume": round(float(row["Volume"]), 0),
                "rsi": round(float(row["RSI"]), 2) if pd.notna(row["RSI"]) else None,
                "usdIdr": round(float(row["USD_IDR"]), 2),
            }
            for idx, row in hist_df.iterrows()
        ]

        fitur_kini = {
            "volume": round(float(df["Volume"].iloc[-1]), 0),
            "rsi": round(float(df["RSI"].iloc[-1]), 2),
            "usdIdr": round(float(df["USD_IDR"].iloc[-1]), 2),
        }

        sinyal = tentukan_sinyal(harga_kini, pred_rounded)
        eval_h = EVAL_DATA.get(kode, {}).get(hari, {})

        return {
            "kode": kode,
            "nama": STOCKS[kode],
            "model": "GRU",
            "fitur": FEATURES,
            "hari": hari,
            "periodeStart": start,
            "periodeEnd": end,
            "totalData": len(df),
            "hargaSekarang": round(harga_kini, 0),
            "fiturKini": fitur_kini,
            "prediksi": pred_rounded,
            "prediksiList": prediksi_list,
            "historis": historis_list,
            "sinyal": sinyal,
            "evaluasi": eval_h,
        }
    except Exception as e:
        return {"error": str(e)}


def evaluasi(kode: str = "BBNI.JK") -> dict:
    kode = str(kode)
    if kode not in EVAL_DATA:
        return {"error": "Kode tidak valid"}
    return {
        "kode": kode,
        "nama": STOCKS[kode],
        "model": "GRU",
        "fitur": FEATURES,
        "hasil": EVAL_DATA[kode],
    }


def status_model() -> dict:
    return {
        k: {
            "GRU": "siap" if k in MODELS else "belum_ada",
            "scaler": "siap" if k.replace(".JK", "") in SCALERS else "belum_ada",
        }
        for k in STOCKS
    }


def prediksi_pretty(kode: str, hari: int, start: str, end: str) -> str:
    return json.dumps(prediksi(kode, hari, start, end, 180), indent=2, ensure_ascii=False)


def create_demo():
    with gr.Blocks(title="SahamPredict GRU") as demo:
        gr.Markdown("# SahamPredict GRU")
        gr.Markdown("Backend Gradio untuk dashboard prediksi saham bank Indonesia.")

        with gr.Row():
            kode = gr.Dropdown(choices=list(STOCKS.keys()), value="BBNI.JK", label="Kode Saham")
            hari = gr.Radio(choices=[7, 14, 30], value=7, label="Horizon")

        with gr.Row():
            start = gr.Textbox(value="2021-06-01", label="Tanggal Mulai")
            end = gr.Textbox(value="2026-06-30", label="Tanggal Akhir")

        output = gr.Code(label="Hasil Prediksi", language="json")
        gr.Button("Prediksi").click(
            prediksi_pretty,
            inputs=[kode, hari, start, end],
            outputs=output,
            api_name="demo_prediksi",
        )

        gr.api(harga_sekarang, api_name="harga_sekarang")
        gr.api(prediksi, api_name="prediksi")
        gr.api(evaluasi, api_name="evaluasi")
        gr.api(status_model, api_name="status_model")

    return demo
