# SahamPredict GRU

Dashboard simulasi prediksi saham bank Indonesia berbasis Flask, React, dan TensorFlow GRU.

## Struktur

- `backend/`: Flask API, TensorFlow GRU, model `.h5`, dan scaler.
- `frontend/`: React Vite dashboard untuk deploy ke Vercel.

## Deploy Frontend ke Vercel

1. Import repository ini di Vercel.
2. Set root directory ke `frontend`.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Tambahkan environment variable:

```txt
VITE_API_URL=https://URL-BACKEND-KAMU
```

Contoh setelah backend Render jadi:

```txt
VITE_API_URL=https://sahampredict-api.onrender.com
```

## Deploy Backend ke Render

Ada tiga cara: pakai Blueprint dari `render.yaml`, Web Service via GitHub App, atau Web Service dari public repo URL.

### Opsi 1: Blueprint

1. Push repo ini ke GitHub.
2. Di Render pilih **New +** lalu **Blueprint**.
3. Connect repository GitHub.
4. Render akan membaca `render.yaml` dan membuat service `sahampredict-api`.
5. Service diset ke `plan: free` dan region `singapore`.
6. Setelah service jadi, buka **Environment** dan ganti:

```txt
CORS_ORIGINS=https://iqbal-saham-predict.vercel.app
```

### Opsi 2: Web Service via GitHub App

1. Di Render pilih **New +** lalu **Web Service**.
2. Connect repository GitHub.
3. Root Directory: `backend`.
4. Runtime: `Python`.
5. Instance Type: `Free`.
6. Region: `Singapore`.
7. Build Command:

```bash
pip install -r requirements.txt
```

8. Start Command:

```bash
gunicorn app:app --bind 0.0.0.0:$PORT --timeout 180
```

9. Tambahkan Environment Variables:

```txt
PYTHON_VERSION=3.11.9
CORS_ORIGINS=https://iqbal-saham-predict.vercel.app
```

### Opsi 3: Public Git Repository

Pakai opsi ini kalau Render sudah dihubungkan ke GitHub, tapi repo tetap tidak muncul.

1. Di Render pilih **New +** lalu **Web Service**.
2. Di bagian **Source Code**, pilih tab **Public Git Repository**.
3. Masukkan URL repo:

```txt
https://github.com/zidanindratama/iqbal-saham-predict
```

4. Isi konfigurasi yang sama seperti opsi manual:

```txt
Name: sahampredict-api
Root Directory: backend
Runtime: Python
Instance Type: Free
Region: Singapore
Build Command: pip install -r requirements.txt
Start Command: gunicorn app:app --bind 0.0.0.0:$PORT --timeout 180
```

5. Tambahkan Environment Variables:

```txt
PYTHON_VERSION=3.11.9
CORS_ORIGINS=https://iqbal-saham-predict.vercel.app
```

## Alur Deploy

1. Push project ke GitHub.
2. Deploy backend ke Render.
3. Salin URL Render, misalnya `https://sahampredict-api.onrender.com`.
4. Masukkan URL itu ke Vercel sebagai `VITE_API_URL`.
5. Deploy frontend ke Vercel.

## Command Git

```bash
git status
git add -A
git commit -m "Update deployment instructions"
git push origin main
```
