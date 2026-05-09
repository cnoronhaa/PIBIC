import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AssemblyAI } from 'assemblyai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' }); // Pasta temporária de upload

const client = new AssemblyAI({
  apiKey: '5bd2731374fd4cc48a5e2705283d183f' // Sua chave
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rota de Upload e Transcrição
app.post('/api/transcrever', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: "Nenhum arquivo enviado." });
  }

  const filePath = req.file.path;

  try {
    console.log("▶️ Arquivo recebido. Iniciando processamento na AssemblyAI...");

    const transcript = await client.transcripts.transcribe({
      audio: filePath,
      language_detection: true,
      speech_models: ['universal-3-pro']
    });

    // Remove o arquivo do servidor imediatamente para poupar espaço
    fs.unlinkSync(filePath);

    if (transcript.status === 'error') throw new Error(transcript.error);

    res.json({ texto: transcript.text, idioma: transcript.language_code });

  } catch (error) {
    // Tenta apagar o arquivo caso dê algum erro no meio do caminho
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error("❌ Erro:", error.message);
    res.status(500).json({ erro: "Erro ao processar o áudio. Tente novamente." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
