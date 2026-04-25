import express from 'express';
import cors from 'cors';
import youtubedl from 'youtube-dl-exec';
import fs from 'fs';
import os from 'os'; // Acha o sistema operacional
import path from 'path'; // Monta os caminhos de pasta
import { AssemblyAI } from 'assemblyai';

const app = express();

const client = new AssemblyAI({
  apiKey: '5bd2731374fd4cc48a5e2705283d183f' // chave AssemblyAI
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/transcricao/:id', async (req, res) => {
  const videoId = req.params.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    console.log(`▶️ Passo 1: Solicitando transcrição via URL para AssemblyAI (${videoId})...`);

    // Em vez de baixar o arquivo, passamos a URL direto para eles!
    const transcript = await client.transcripts.transcribe({
      audio: videoUrl, // A AssemblyAI aceita links do YouTube!
      language_detection: true,
      speech_models: ['universal-3-pro']
    });

    if (transcript.status === 'error') {
      console.error("❌ Erro na AssemblyAI:", transcript.error);
      return res.status(500).json({ erro: "Erro ao processar áudio." });
    }

    console.log("✅ Transcrição finalizada com sucesso!");
    res.json({ texto: transcript.text, idioma: transcript.language_code });

  } catch (error) {
    console.error("❌ Erro geral no servidor:", error.message);
    res.status(500).json({ erro: "Não foi possível processar o vídeo." });
  }
});

app.listen(3000, () => console.log("Servidor ON"));
