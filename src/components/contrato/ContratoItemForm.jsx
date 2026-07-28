import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ContratoItemForm({ initialItem, onCancel, onSave }) {
  const [form, setForm] = useState({
    item_codigo: "",
    item_label: "",
    descricao: "",
    unidade: "",
    qtd_contrato: "",
    preco_unit: "",
    preco_unit_com_bdi: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialItem) {
      setForm({
        item_codigo: initialItem.item_codigo || "",
        item_label: initialItem.item_label || "",
        descricao: initialItem.descricao || "",
        unidade: initialItem.unidade || "",
        qtd_contrato: initialItem.qtd_contrato ?? "",
        preco_unit: initialItem.preco_unit ?? "",
        preco_unit_com_bdi: initialItem.preco_unit_com_bdi ?? "",
      });
    }
    setErrors({});
  }, [initialItem]);

  // Atualiza o campo e limpa o erro dele (o aviso some assim que corrige).
  const update = (k, v) => {
    setForm((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const cls = (campo) => (errors[campo] ? "border-red-400 focus-visible:ring-red-400" : "");

  const validar = () => {
    const e = {};
    if (!String(form.item_codigo).trim()) e.item_codigo = "Informe o código.";
    if (!String(form.unidade).trim()) e.unidade = "Informe a unidade.";
    if (!String(form.descricao).trim()) e.descricao = "Informe a descrição.";
    if (!(Number(form.qtd_contrato) > 0)) e.qtd_contrato = "Quantidade deve ser maior que zero.";
    if (!(Number(form.preco_unit_com_bdi) > 0)) e.preco_unit_com_bdi = "Preço c/ BDI deve ser maior que zero.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    const codigo = String(form.item_codigo).trim();
    const desc = String(form.descricao || '').trim();
    const payload = {
      item_codigo: codigo,
      // Rótulo (apelido curto p/ exibições compactas) é DERIVADO — não é campo do
      // usuário. Mesma regra do import do OrçaFácil e da geração de contrato.
      item_label: `${codigo} ${desc}`.trim().slice(0, 60),
      descricao: desc,
      unidade: String(form.unidade || '').trim(),
      qtd_contrato: form.qtd_contrato === "" ? 0 : Number(form.qtd_contrato),
      preco_unit: form.preco_unit === "" ? 0 : Number(form.preco_unit),
      preco_unit_com_bdi: form.preco_unit_com_bdi === "" ? 0 : Number(form.preco_unit_com_bdi),
    };
    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Código + Unidade dividem a linha inteira (50/50), sem sobrar coluna vazia. */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="item_codigo">Código *</Label>
              <Input id="item_codigo" value={form.item_codigo} onChange={(e) => update('item_codigo', e.target.value)} className={cls('item_codigo')} />
              {errors.item_codigo && <p className="text-xs text-red-600 mt-1">{errors.item_codigo}</p>}
            </div>
            <div>
              <Label htmlFor="unidade">Unidade *</Label>
              <Input id="unidade" value={form.unidade} onChange={(e) => update('unidade', e.target.value)} className={cls('unidade')} />
              {errors.unidade && <p className="text-xs text-red-600 mt-1">{errors.unidade}</p>}
            </div>
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input id="descricao" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} className={cls('descricao')} />
            {errors.descricao && <p className="text-xs text-red-600 mt-1">{errors.descricao}</p>}
          </div>
          <div>
            <Label htmlFor="qtd_contrato">Qtd. Contrato *</Label>
            <Input id="qtd_contrato" type="number" step="0.000001" value={form.qtd_contrato} onChange={(e) => update('qtd_contrato', e.target.value)} className={cls('qtd_contrato')} />
            {errors.qtd_contrato && <p className="text-xs text-red-600 mt-1">{errors.qtd_contrato}</p>}
          </div>
          <div>
            <Label htmlFor="preco_unit">Preço Unit. (base)</Label>
            <Input id="preco_unit" type="number" step="0.000001" value={form.preco_unit} onChange={(e) => update('preco_unit', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="preco_unit_com_bdi">Preço Unit. c/ BDI *</Label>
            <Input id="preco_unit_com_bdi" type="number" step="0.000001" value={form.preco_unit_com_bdi} onChange={(e) => update('preco_unit_com_bdi', e.target.value)} className={cls('preco_unit_com_bdi')} />
            {errors.preco_unit_com_bdi && <p className="text-xs text-red-600 mt-1">{errors.preco_unit_com_bdi}</p>}
          </div>

          <div className="md:col-span-3 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
    </form>
  );
}
