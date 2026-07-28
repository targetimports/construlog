import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function IAResumo({ resumoTexto }) {
  if (!resumoTexto) return null;
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Resumo IA</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{resumoTexto}</p>
      </CardContent>
    </Card>
  );
}