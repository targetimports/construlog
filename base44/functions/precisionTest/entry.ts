import Decimal from 'npm:decimal.js@10.4.3';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function TRUNC2(x) {
  const d = new Decimal(x);
  const scaled = d.mul(100);
  const t = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return t.div(100);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const samples = [10.239, 10.235, -10.239, -10.235];
    const expected = [10.23, 10.23, -10.23, -10.23];

    const results = samples.map((v, i) => {
      const out = TRUNC2(v).toNumber();
      return { in: v, out, expected: expected[i], pass: out === expected[i] };
    });

    return Response.json({
      rule: 'TRUNC2 towards zero (no rounding)',
      results,
      all_pass: results.every(r => r.pass),
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});