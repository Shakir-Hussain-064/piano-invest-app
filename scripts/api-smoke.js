import assert from 'node:assert/strict';
const base='http://127.0.0.1:3001/api';let cookie='',csrf='';
async function request(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',cookie,'x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const sc=r.headers.getSetCookie();if(sc.length)cookie=sc.map(x=>x.split(';')[0]).join('; ');const d=await r.json();if(d.csrf)csrf=d.csrf;return {status:r.status,...d};}
let d=await request('/config');assert.ok(d.csrf);
const question=(await request('/captcha')).question;const answer=question.split(' + ').map(Number).reduce((a,b)=>a+b,0);
const email=`piano.test.${Date.now()}@gmail.com`,password='Test-only-9364';
assert.equal((await request('/signup',{name:'Test Musician',email,password,captcha:String(answer),referral:''})).status,201);
assert.equal((await request('/login',{email,password})).status,200);
const r1=crypto.randomUUID();d=await request('/wallet/demo-recharge',{amount:100000,requestId:r1});assert.equal(d.user.wallet,100000);
d=await request('/wallet/demo-recharge',{amount:100000,requestId:r1});assert.equal(d.user.wallet,100000);
const req=crypto.randomUUID();const [a,b]=await Promise.all([request('/plans/buy',{planId:'piano-500',requestId:req}),request('/plans/buy',{planId:'piano-500',requestId:req})]);assert.equal(a.status,200);assert.equal(b.status,200);
d=await request('/me');assert.equal(d.user.wallet,50000);assert.equal(d.user.investments.length,1);
assert.equal((await request('/wallet/withdraw',{amount:49900,bank:{name:'Test Musician',accountNumber:'123456789012',ifsc:'HDFC0001234'},confirmAccount:'123456789012',password,requestId:crypto.randomUUID()})).status,400);
d=await request('/wallet/withdraw',{amount:50000,bank:{name:'Test Musician',accountNumber:'123456789012',ifsc:'HDFC0001234'},confirmAccount:'123456789012',password,requestId:crypto.randomUUID()});assert.equal(d.user.wallet,0);assert.equal(d.user.withdrawals[0].status,'pending');
const csrfBefore=csrf;csrf='bad';assert.equal((await request('/wallet/demo-recharge',{amount:100000,requestId:crypto.randomUUID()})).status,403);csrf=csrfBefore;
assert.equal((await request('/logout',{})).status,200);assert.equal((await request('/me')).status,401);
console.log('API smoke passed: signup/login, duplicate recharge, concurrent purchase, withdrawal minimum/reservation, CSRF and logout.');
