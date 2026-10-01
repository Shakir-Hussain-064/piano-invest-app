import {writeFileSync} from 'node:fs';

const value=process.argv[2];
if(!value)throw new Error('Usage: node scripts/configure-vercel.js https://YOUR-BACKEND.onrender.com');
const url=new URL(value);
if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.hostname==='localhost'||url.hostname.endsWith('.invalid')){
 throw new Error('Provide the real public HTTPS backend origin without credentials, path, query or fragment.');
}
const config={
 $schema:'https://openapi.vercel.sh/vercel.json',
 framework:'vite',buildCommand:'npm run build',outputDirectory:'dist',
 rewrites:[
  {source:'/api/:path*',destination:`${url.origin}/api/:path*`},
  {source:'/owner',destination:'/index.html'}
 ],
 headers:[
  {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
  {source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}
 ]
};
writeFileSync(new URL('../vercel.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('Created vercel.json with the supplied backend origin. No secrets included.');
