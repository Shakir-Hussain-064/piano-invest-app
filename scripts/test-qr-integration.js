import 'dotenv/config';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import mongoose from 'mongoose';
import {setTimeout as delay} from 'node:timers/promises';
const dbName='piano_qr_integration_'+randomBytes(8).toString('hex');
const port=33000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
const uri=new URL(process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/piano');uri.pathname='/'+dbName;
let child;
async function start(){
 child=spawn(process.execPath,['server/index.js'],{env:{...process.env,MONGODB_URI:uri.toString(),NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',SESSION_SECRET:randomBytes(48).toString('hex')},stdio:'ignore',windowsHide:true});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)return;}catch{}await delay(100);}throw new Error('Integration server did not start.');
}
function client(){let cookie='',csrf='';return async(route,body,expected=200,withoutCsrf=false)=>{
 const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json',...(!withoutCsrf?{'x-csrf-token':csrf}:{})},body:body?JSON.stringify(body):undefined});
 const setCookie=r.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];const d=await r.json();if(d.csrf)csrf=d.csrf;
 if(expected!==null)assert.equal(r.status,expected,`${route}: ${JSON.stringify(d)}`);return {...d,httpStatus:r.status};
};}
const password='Local-integration-only!29';
async function register(c,email){await c('/config');const {question}=await c('/captcha');const captcha=String(question.split(' + ').map(Number).reduce((a,b)=>a+b));await c('/signup',{name:'Integration User',email,password,captcha,role:'owner'},201);const login=await c('/login',{email,password});assert.equal(login.policyAcknowledged,false);await c('/payments/claims',{amount:50000,utr:'999999999999',requestId:randomUUID()},403);await c('/policy/acknowledge',{version:'2026-09-26.1',accepted:false},400);await c('/policy/acknowledge',{version:'2026-09-26.1',accepted:true});return login.user;}
try{
 await mongoose.connect(uri.toString());await start();const a=client(),b=client(),owner=client();
 const ua=await register(a,'a@gmail.com');await register(b,'b@gmail.com');const uo=await register(owner,'owner@gmail.com');
 assert.equal(ua.isOwner,false);await a('/owner/recharges',undefined,403);
 await mongoose.connection.collection('users').updateOne({_id:new mongoose.Types.ObjectId(uo._id)},{$set:{role:'owner'}});
 const claim={amount:50000,utr:'123456789012',requestId:randomUUID()};
 await a('/payments/claims',claim,403,true);await a('/payments/claims',{...claim,utr:'fake'},400);
 const raced=await Promise.all([a,b].map(c=>c('/payments/claims',{...claim,requestId:randomUUID()},null)));
 assert.deepEqual(raced.map(r=>r.httpStatus).sort(),[202,409]);
 const all=await mongoose.connection.collection('recharges').find({utr:claim.utr}).toArray();assert.equal(all.length,1);
 assert.equal((await a('/me')).user.wallet,0);assert.equal((await b('/me')).user.wallet,0);
 const c=all[0],recipient=String(c.userId)===ua._id?a:b;
 const queue=await owner('/owner/recharges');assert.equal(queue.claims.length,1);assert.equal(queue.claims[0].account.id,String(c.userId));
 const other=recipient===a?b:a;assert.equal((await other('/payments/claims')).claims.length,0);
 await a('/payments/order',{amount:50000},404);
 await recipient('/payments/claims',{...claim,requestId:c._id},200);
 await a('/payments/claims',{...claim,requestId:randomUUID()},409);
 const review={decision:'approve',password,ownerConfirmed:true};
 await a(`/owner/recharges/${c._id}/review`,review,403);
 await owner(`/owner/recharges/${c._id}/review`,{...review,password:'wrong'},403);

 await owner(`/owner/recharges/${c._id}/review`,{...review,ownerConfirmed:false},400);
 await owner(`/owner/recharges/${c._id}/review`,{...review,amount:9999999,utr:'000000000000',userId:'tampered'});
 await Promise.all(Array.from({length:4},()=>owner(`/owner/recharges/${c._id}/review`,review)));
 const credited=(await recipient('/me')).user;assert.equal(credited.wallet,50000);assert.equal(credited.transactions.filter(t=>t.id===`qr-${c._id}`).length,1);
 await owner(`/owner/recharges/${c._id}/review`,{...review,decision:'reject'},400);
 const c2={amount:60000,utr:'123456789013',requestId:randomUUID()};await a('/payments/claims',c2,202);
 await owner(`/owner/recharges/${c2.requestId}/review`,{...review,amount:c2.amount,utr:c2.utr,decision:'reject'});
 await owner(`/owner/recharges/${c2.requestId}/review`,{...review,amount:c2.amount,utr:c2.utr},400);
 const c3={amount:70000,utr:'123456789014',requestId:randomUUID()};await a('/payments/claims',c3,202);
 await mongoose.connection.collection('recharges').updateOne({_id:c3.requestId},{$set:{status:'approving',reviewedBy:new mongoose.Types.ObjectId(uo._id),reviewedAt:new Date()}});
 const before=(await a('/me')).user.wallet;child.kill();await new Promise(resolve=>child.once('exit',resolve));await start();
 const recovered=await mongoose.connection.collection('users').findOne({_id:new mongoose.Types.ObjectId(ua._id)});assert.equal(recovered.wallet,before+70000);
 assert.equal((await mongoose.connection.collection('recharges').findOne({_id:c3.requestId})).status,'approved');
 console.log('PASS: global unique UTR, CSRF, owner authorization, server-stored amount and UTR protection, concurrent approval, rejection, crash recovery. No real payments made.');
}finally{
 if(child){child.kill();}
 if(mongoose.connection.name===dbName&&/^piano_qr_integration_[a-f0-9]{16}$/.test(dbName))await mongoose.connection.dropDatabase();
 await mongoose.disconnect();
}
