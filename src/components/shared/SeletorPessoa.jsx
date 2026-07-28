import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem 
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Plus, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SeletorPessoa({ 
  value, 
  onChange, 
  tipos = ['colaborador', 'motorista', 'usuario'],
  placeholder = "Selecione uma pessoa...",
  label = "Pessoa",
  obraId = null,
  required = false,
  error = false
}) {
  const [open, setOpen] = useState(false);
  const [dialogCriar, setDialogCriar] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null);
  const [formTemp, setFormTemp] = useState({
    nome: '',
    tipo: tipos[0] || 'colaborador',
    cpf: '',
    telefone: '',
    email: '',
    empresa: '',
    funcao: '',
    obra_id: obraId
  });

  // Buscar todas as fontes de pessoas
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    enabled: tipos.includes('usuario')
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list(),
    enabled: tipos.includes('colaborador')
  });

  const { data: motoristas = [] } = useQuery({
    queryKey: ['motoristas'],
    queryFn: () => base44.entities.Motorista.list(),
    enabled: tipos.includes('motorista')
  });

  const { data: temporarios = [] } = useQuery({
    queryKey: ['pessoas-temporarias'],
    queryFn: () => base44.entities.PessoaTemporaria.filter({ status: 'temporario' })
  });

  // Consolidar todas as pessoas
  const todasPessoas = [
    ...usuarios.map(u => ({ 
      id: u.id, 
      nome: u.full_name, 
      email: u.email, 
      tipo: 'usuario',
      badge: null 
    })),
    ...colaboradores.map(c => ({ 
      id: c.id, 
      nome: c.nome, 
      cpf: c.cpf, 
      tipo: 'colaborador',
      badge: null 
    })),
    ...motoristas.map(m => ({ 
      id: m.id, 
      nome: m.nome, 
      cpf: m.cpf, 
      tipo: 'motorista',
      badge: null 
    })),
    ...temporarios.map(t => ({ 
      id: t.id, 
      nome: t.nome, 
      cpf: t.cpf, 
      email: t.email,
      tipo: t.tipo,
      badge: 'TEMP',
      isTemp: true
    }))
  ];

  // Encontrar pessoa selecionada
  React.useEffect(() => {
    if (value) {
      const pessoa = todasPessoas.find(p => p.id === value);
      setPessoaSelecionada(pessoa);
    } else {
      setPessoaSelecionada(null);
    }
  }, [value, todasPessoas]);

  const criarTemporario = async () => {
    try {
      if (!formTemp.nome) {
        toast.error('Nome é obrigatório');
        return;
      }

      const novaPessoa = await base44.entities.PessoaTemporaria.create(formTemp);
      
      // Selecionar automaticamente
      onChange(novaPessoa.id);
      setPessoaSelecionada({
        id: novaPessoa.id,
        nome: novaPessoa.nome,
        tipo: novaPessoa.tipo,
        badge: 'TEMP',
        isTemp: true
      });

      setDialogCriar(false);
      setFormTemp({
        nome: '',
        tipo: tipos[0] || 'colaborador',
        cpf: '',
        telefone: '',
        email: '',
        empresa: '',
        funcao: '',
        obra_id: obraId
      });
      
      toast.success('Pessoa temporária criada com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar pessoa temporária: ' + error.message);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-gray-700 font-medium">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "flex-1 justify-between",
                !value && "text-gray-500",
                error && "border-red-400 focus-visible:ring-red-400"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {pessoaSelecionada ? (
                  <span className="truncate">
                    {pessoaSelecionada.nome}
                    {pessoaSelecionada.badge && (
                      <Badge className="ml-2 bg-orange-100 text-orange-700 border-orange-300">
                        {pessoaSelecionada.badge}
                      </Badge>
                    )}
                  </span>
                ) : (
                  placeholder
                )}
              </div>
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0">
            <Command>
              <CommandInput placeholder="Buscar por nome, CPF ou email..." />
              <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {todasPessoas.map((pessoa) => (
                  <CommandItem
                    key={pessoa.id}
                    value={`${pessoa.nome} ${pessoa.cpf || ''} ${pessoa.email || ''}`}
                    onSelect={() => {
                      onChange(pessoa.id);
                      setPessoaSelecionada(pessoa);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === pessoa.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pessoa.nome}</span>
                        {pessoa.badge && (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                            {pessoa.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {pessoa.email || pessoa.cpf || pessoa.tipo}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          onClick={() => setDialogCriar(true)}
          className="flex-shrink-0 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Dialog Criar Temporário */}
      <Dialog open={dialogCriar} onOpenChange={setDialogCriar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Pessoa Temporária</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formTemp.nome}
                onChange={(e) => setFormTemp({ ...formTemp, nome: e.target.value })}
                placeholder="Nome da pessoa"
              />
            </div>

            <div>
              <Label>Tipo *</Label>
              <Select 
                value={formTemp.tipo} 
                onValueChange={(v) => setFormTemp({ ...formTemp, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="motorista">Motorista</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="visitante">Visitante</SelectItem>
                  <SelectItem value="terceirizado">Terceirizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input
                  value={formTemp.cpf}
                  onChange={(e) => setFormTemp({ ...formTemp, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formTemp.telefone}
                  onChange={(e) => setFormTemp({ ...formTemp, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formTemp.email}
                onChange={(e) => setFormTemp({ ...formTemp, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <Label>Função/Cargo</Label>
              <Input
                value={formTemp.funcao}
                onChange={(e) => setFormTemp({ ...formTemp, funcao: e.target.value })}
                placeholder="Ex: Pedreiro, Motorista..."
              />
            </div>

            {formTemp.tipo === 'terceirizado' && (
              <div>
                <Label>Empresa</Label>
                <Input
                  value={formTemp.empresa}
                  onChange={(e) => setFormTemp({ ...formTemp, empresa: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogCriar(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={criarTemporario}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar e Selecionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}