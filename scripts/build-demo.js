process.env.VITE_STATIC_DEMO='true';
const {build}=await import('vite');
await build();
