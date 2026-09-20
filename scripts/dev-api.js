process.env.USE_MEMORY_DB='true';
process.env.DEMO_PAYMENTS='true';
await import('../server/index.js');
