---
title: SahamPredict GRU
sdk: gradio
app_file: app.py
---

# SahamPredict GRU

Dashboard simulasi prediksi saham bank Indonesia berbasis Flask, React, dan TensorFlow GRU.

## Struktur

- `backend/`: Flask API, TensorFlow GRU, model `.h5`, dan scaler.
- `frontend/`: React Vite dashboard untuk deploy ke Vercel.
- `app.py`: Gradio backend untuk deploy gratis ke Hugging Face Spaces.
- `requirements.txt`: dependency untuk Hugging Face Gradio Space.

## Deploy Backend ke Hugging Face Spaces

1. Buat Space baru di Hugging Face.
2. Pilih **Manual setup**.
3. Space SDK: **Gradio**.
4. Template: **Blank**.
5. Hardware: **CPU Basic** atau opsi free yang tersedia.
6. Visibility: **Public**.
7. Setelah Space dibuat, push repo ini ke remote Space Hugging Face.

Contoh remote Hugging Face:

```bash
git remote add hf https://huggingface.co/spaces/zidanindratama/iqbal-saham-predict
git push hf main
```

Gradio backend menyediakan endpoint:

```txt
/harga_sekarang
/prediksi
/evaluasi
/status_model
```

Endpoint tersebut dipanggil frontend lewat `@gradio/client`.

## Deploy Frontend ke Vercel

1. Import repository ini di Vercel.
2. Set root directory ke `frontend`.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Tambahkan environment variable:

```txt
VITE_GRADIO_SPACE=zidanindratama/iqbal-saham-predict
```

## Alur Deploy

1. Push project ke GitHub.
2. Buat Hugging Face Space dengan SDK Gradio.
3. Push repo ke remote Hugging Face Space.
4. Deploy frontend di Vercel dengan `VITE_GRADIO_SPACE`.
5. Redeploy frontend setiap kali env berubah.

## Command Git

```bash
git status
git add -A
git commit -m "Add Hugging Face Gradio backend"
git push origin main
```
