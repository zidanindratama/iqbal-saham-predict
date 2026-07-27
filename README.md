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
