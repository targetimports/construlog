import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { webhook_url, webhook_secret } = body;

    if (!webhook_url) {
      return Response.json({ error: 'webhook_url obrigatório' }, { status: 400 });
    }

    // Mock URLs
    if (webhook_url.startsWith('mock://')) {
      const result = webhook_url.split(':')[1] || 'success';
      const status_code = result === 'success' ? 200 : (result.includes('fail') ? 500 : 200);
      return Response.json({
        ok: true,
        build_id: `WEBHOOK-TEST-${Date.now()}`,
        webhook_url,
        status_code,
        latency_ms: Math.random() * 100 + 10,
        response_body: result === 'success' ? 'OK' : 'Server Error'
      });
    }

    // Real HTTPS fetch com timeout
    const controller = new AbortController();
    const timeout_ms = 5000;
    const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

    const start = Date.now();
    let response;
    let status_code;
    let response_body = '';

    try {
      const payload = { test: true, timestamp: new Date().toISOString() };
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'OpsOutbox-Tester/1.0'
      };

      if (webhook_secret) {
        const ts = new Date().toISOString();
        const message = `${ts}.${JSON.stringify(payload)}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const key = encoder.encode(webhook_secret);
        const hashBuffer = await crypto.subtle.sign('HMAC', 
          await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
          data
        );
        const sig = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        headers['X-Ops-Signature'] = `sha256=${sig}`;
        headers['X-Ops-Timestamp'] = ts;
      }

      response = await fetch(webhook_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      status_code = response.status;
      response_body = await response.text();
    } catch (error) {
      status_code = error.name === 'AbortError' ? 408 : 500;
      response_body = error.name === 'AbortError' ? 'Timeout' : error.message;
    } finally {
      clearTimeout(timeoutId);
    }

    const latency_ms = Date.now() - start;

    return Response.json({
      ok: true,
      build_id: `WEBHOOK-TEST-${Date.now()}`,
      webhook_url,
      status_code,
      latency_ms,
      response_body: response_body.substring(0, 200)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});