import express from 'express';
import cors from 'cors';
import youtubedl from 'youtube-dl-exec';
import ytdl from '@distube/ytdl-core';
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
    console.log(`▶️ Tentando obter stream de áudio para: ${videoId}`);

    // Pegamos as informações do vídeo e o link direto do áudio
    const info = await ytdl.getInfo(videoUrl);
    const audioUrl = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' }).url;

    console.log("✅ Link de áudio extraído. Enviando para AssemblyAI...");

    const transcript = await client.transcripts.transcribe({
      audio: audioUrl, // Enviamos o link direto do arquivo de áudio, não a página do YouTube
      language_detection: true,
      speech_models: ['universal-3-pro']
    });

    if (transcript.status === 'error') throw new Error(transcript.error);

    res.json({ texto: transcript.text, idioma: transcript.language_code });

  } catch (error) {
    console.error("❌ Erro técnico:", error.message);
    
    // Se ainda assim der erro, vamos avisar que é uma limitação do YouTube
    res.status(500).json({ 
      erro: "O YouTube bloqueou o acesso temporariamente. Tente outro vídeo ou tente mais tarde." 
    });
  }
});

app.listen(3000, () => console.log("Servidor ON"));
