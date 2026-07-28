Deno.serve(async (req) => {
  try {
    return Response.json({
      ok: true,
      build_id: 'PING-2026-02-14-02',
      timestamp: Date.now(),
      message: 'Deployment active and responding'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});