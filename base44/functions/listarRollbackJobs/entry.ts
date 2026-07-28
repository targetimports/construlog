import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'LIST-JOBS-' + Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { status, limit = 20, skip = 0 } = body;

    // Build filter
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Fetch jobs
    const jobs = await base44.asServiceRole.entities.RollbackJob.filter(filter, '-initiated_at', limit + skip);
    const allJobs = Array.isArray(jobs) ? jobs : [];
    
    // Paginate
    const paginatedJobs = allJobs.slice(skip, skip + limit);

    return Response.json({
      ok: true,
      jobs: paginatedJobs,
      total: allJobs.length,
      limit: limit,
      skip: skip,
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});