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
  
  // salva na pasta temp do Windows
  const audioPath = path.join(os.tmpdir(), `audio_temp_${videoId}.webm`); 

  try {
    console.log(`▶️ Passo 1: Extraindo áudio à força do YouTube (${videoId})...`);

    await youtubedl(videoUrl, {
      format: 'bestaudio',
      output: audioPath,
      noWarnings: true
    });

    console.log("✅ Áudio extraído! \n▶️ Passo 2: Enviando para a AssemblyAI...");
    
    try {
      const transcript = await client.transcripts.transcribe({
        audio: audioPath, 
        language_detection: true,
        speech_models: ['universal-3-pro'] 
      });

      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      console.log("✅ Transcrição finalizada com sucesso!");
      res.json({ 
          texto: transcript.text, 
          idioma: transcript.language_code 
      });

      // Limpeza invisível
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      
    } catch (apiError) {
      console.error("❌ Erro na AssemblyAI:", apiError.message);
      res.status(500).json({ erro: "A IA não conseguiu processar o áudio." });
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }

  } catch (error) {
    console.error("❌ Erro ao baixar do YouTube:", error.message);
    res.status(500).json({ erro: "O YouTube bloqueou o vídeo. Tente outro link." });
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
});

app.listen(3000, () => console.log("Servidor ON"));