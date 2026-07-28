import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, StopCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BotaoCapturarAudio({ onAudioCapturado, label = 'Áudio' }) {
  const [gravando, setGravando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const recognitionRef = useRef(null);

  const iniciarCaptura = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Seu navegador não suporta reconhecimento de voz');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setGravando(true);
    };

    recognition.onresult = (event) => {
      setProcessando(true);
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      
      if (transcript.trim()) {
        onAudioCapturado(transcript);
        toast.success(`Áudio capturado: "${transcript}"`);
      } else {
        toast.error('Nenhum áudio detectado');
      }
      setProcessando(false);
    };

    recognition.onerror = (event) => {
      console.error('Erro ao capturar áudio:', event.error);
      toast.error('Erro ao capturar áudio: ' + event.error);
      setGravando(false);
      setProcessando(false);
    };

    recognition.onend = () => {
      setGravando(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const pararCaptura = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setGravando(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={gravando ? pararCaptura : iniciarCaptura}
      disabled={processando}
      size="icon"
      variant={gravando ? 'destructive' : 'outline'}
      title={gravando ? 'Parar gravação' : `Capturar ${label} por áudio`}
      className="flex-shrink-0"
    >
      {processando ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : gravando ? (
        <StopCircle className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
}