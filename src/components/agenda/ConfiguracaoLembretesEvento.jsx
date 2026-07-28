import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Clock, Plus, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ConfiguracaoLembretesEvento({ 
  defaultReminders = [],
  onRemindersChange,
  showEmailToggle = true 
}) {
  const [usarPadrao, setUsarPadrao] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [lembretes, setLembretes] = useState([]);
  const [novoLembrete, setNovoLembrete] = useState({ value: 2, unit: 'HOURS' });

  const handleTogglePersonalizar = (checked) => {
    setUsarPadrao(!checked);
    if (checked) {
      // Personalizar: copiar lembretes padrão
      setLembretes([...defaultReminders]);
      onRemindersChange?.({ enabled: true, reminders: defaultReminders, sendEmail: enviarEmail });
    } else {
      // Voltar ao padrão
      setLembretes([]);
      onRemindersChange?.({ enabled: false, reminders: [], sendEmail: enviarEmail });
    }
  };

  const handleToggleEmail = (checked) => {
    setEnviarEmail(checked);
    onRemindersChange?.({ 
      enabled: !usarPadrao, 
      reminders: usarPadrao ? [] : lembretes,
      sendEmail: checked 
    });
  };

  const handleAddLembrete = () => {
    if (!novoLembrete.value || novoLembrete.value <= 0) return;

    const novosLembretes = [
      ...lembretes,
      { type: 'BEFORE_START', value: novoLembrete.value, unit: novoLembrete.unit }
    ];
    setLembretes(novosLembretes);
    onRemindersChange?.({ enabled: !usarPadrao, reminders: novosLembretes, sendEmail: enviarEmail });
    setNovoLembrete({ value: 2, unit: 'HOURS' });
  };

  const handleRemoveLembrete = (index) => {
    const novosLembretes = lembretes.filter((_, idx) => idx !== index);
    setLembretes(novosLembretes);
    onRemindersChange?.({ enabled: !usarPadrao, reminders: novosLembretes, sendEmail: enviarEmail });
  };

  const formatReminder = (reminder) => {
    if (reminder.type === 'AT_TIME') return 'No horário do evento';
    const units = {
      MINUTES: 'minutos',
      HOURS: 'horas',
      DAYS: 'dias'
    };
    return `${reminder.value} ${units[reminder.unit] || reminder.unit} antes`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-base">Notificações e Lembretes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Toggle Enviar E-mail */}
        {showEmailToggle && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <Label className="text-sm font-medium cursor-pointer">
                Enviar e-mail aos participantes
              </Label>
            </div>
            <Switch checked={enviarEmail} onCheckedChange={handleToggleEmail} />
          </div>
        )}

        {enviarEmail && (
          <>
            {/* Toggle Personalizar */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Personalizar lembretes deste evento</Label>
              <Switch checked={!usarPadrao} onCheckedChange={handleTogglePersonalizar} />
            </div>

            {/* Lembretes Padrão */}
            {usarPadrao && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Usando lembretes padrão da sua conta:</p>
                <div className="flex flex-wrap gap-2">
                  {defaultReminders.length > 0 ? (
                    defaultReminders.map((reminder, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatReminder(reminder)}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Nenhum lembrete padrão configurado</p>
                  )}
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Configure seus lembretes padrão em <strong>Ajustes → Notificações</strong>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Lembretes Personalizados */}
            {!usarPadrao && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Lembretes personalizados:</p>
                
                {/* Lista */}
                <div className="flex flex-wrap gap-2">
                  {lembretes.map((reminder, idx) => (
                    <Badge key={idx} variant="secondary" className="pl-3 pr-2 py-1.5">
                      <Clock className="w-3 h-3 mr-1.5" />
                      {formatReminder(reminder)}
                      <button
                        onClick={() => handleRemoveLembrete(idx)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {lembretes.length === 0 && (
                    <p className="text-sm text-gray-500">Nenhum lembrete. Adicione abaixo.</p>
                  )}
                </div>

                {/* Adicionar */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Valor"
                        value={novoLembrete.value}
                        onChange={(e) => setNovoLembrete({ ...novoLembrete, value: parseInt(e.target.value) })}
                        className="w-20"
                      />
                      <Select
                        value={novoLembrete.unit}
                        onValueChange={(value) => setNovoLembrete({ ...novoLembrete, unit: value })}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MINUTES">minutos</SelectItem>
                          <SelectItem value="HOURS">horas</SelectItem>
                          <SelectItem value="DAYS">dias</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="flex items-center text-sm text-gray-600">antes</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleAddLembrete}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}