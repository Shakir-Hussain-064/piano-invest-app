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
 child=spawn(process.execPath,['server/index.js'],{env:{...process.env,MONGODB_URI:uri.toString(),NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',SESSION_SECRET:randomBytes(48).toString('hex'),BANK_DATA_KEY:'ab'.repeat(32)},stdio:'ignore',windowsHide:true});
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
 await mongoose.connect(uri.toString());await start();const a=client(),owner=client();
 const ua=await register(a,'member@gmail.com'),uo=await register(owner,'owner@gmail.com');
 await mongoose.connection.collection('users').updateOne({_id:new mongoose.Types.ObjectId(uo._id)},{$set:{role:'owner'}});
 assert.equal((await fetch(base+'/owner')).status,200);
 for(const route of ['/plans/buy','/wallet/withdraw','/payments/claims'])await owner(route,{},403);
 // Isolated fixture balance, never a real customer balance.
 await mongoose.connection.collection('users').updateOne({_id:new mongoose.Types.ObjectId(ua._id)},{$set:{wallet:400000}});
 for(const route of ['/owner/analytics','/owner/users','/owner/withdrawals'])await a(route,undefined,403);
 const bank={amount:100000,bank:{method:'bank',name:'Fixture Recipient',accountNumber:'12345678901',ifsc:'HDFC0001234'},confirmAccount:'12345678901',password,requestId:randomUUID()};
 const upi={amount:120000,bank:{method:'upi',name:'Fixture Recipient',upi:'fixture@bank'},confirmAccount:'',password,requestId:randomUUID()};
 for(const request of [bank,upi]){const response=await a('/wallet/withdraw',request,202);assert.equal(response.user.withdrawals[0].status,'awaiting_owner');assert.ok(!JSON.stringify(response).includes('bankEncrypted'));}
 await a('/wallet/withdraw',bank,202);assert.equal((await a('/me')).user.wallet,180000);
 const queue=await owner('/owner/withdrawals');assert.equal(queue.total,2);assert.ok(queue.withdrawals.every(w=>w.canReview));assert.ok(!JSON.stringify(queue).includes('12345678901'));assert.ok(!JSON.stringify(queue).includes('fixture@bank'));
 assert.equal((await a('/config')).payoutsConfigured,false);
 const analytics=await owner('/owner/analytics');assert.equal(analytics.payoutsConfigured,false);assert.equal(analytics.totals.totalUsers,2);assert.equal(analytics.totals.walletBalance,180000);assert.equal(analytics.totals.pendingWithdrawalAmount,220000);assert.equal(analytics.totals.pendingWithdrawalCount,2);
 const users=await owner('/owner/users?q=member');assert.equal(users.total,1);assert.equal(users.users[0].pendingWithdrawals,220000);assert.ok(!JSON.stringify(users).includes('passwordHash'));
 const path='/owner/withdrawals/'+ua._id+'/'+bank.requestId+'/review';
 const review={decision:'initiate',password,note:'Confirmed destination',confirmed:true};
 await a(path,review,403);await owner(path,{...review,password:'wrong'},403);await owner(path,review,503);
 assert.equal((await owner('/owner/withdrawals')).withdrawals[0].status,'awaiting_owner');
 await Promise.all(Array.from({length:3},()=>owner(path,{...review,decision:'reject'})));
 const after=(await a('/me')).user;assert.equal(after.wallet,280000);assert.equal(after.transactions.filter(t=>t.id==='refund-'+bank.requestId).length,1);
 const history=await owner('/owner/withdrawals?view=history');assert.equal(history.total,1);assert.equal(history.withdrawals[0].status,'rejected');
 const latest=await owner('/owner/analytics');assert.equal(latest.totals.pendingWithdrawalAmount,120000);assert.equal(latest.totals.walletBalance,280000);
 const loginAgain=await a('/login',{email:'member@gmail.com',password});assert.equal(loginAgain.policyAcknowledged,false);
 assert.equal((await a('/me')).policyAcknowledged,false);
 await a('/policy/acknowledge',{version:'old-version',accepted:true},400);
 await a('/policy/acknowledge',{version:'2026-09-26.1',accepted:true});assert.equal((await a('/me')).policyAcknowledged,true);
 const recorded=await mongoose.connection.collection('users').findOne({_id:new mongoose.Types.ObjectId(ua._id)});assert.equal(recorded.policyVersion,'2026-09-26.1');assert.ok(recorded.policyAcceptedAt instanceof Date);
 console.log('PASS: owner-only analytics and queue, Bank/UPI requests, masked data, wallet reservation, removed-payout guard, concurrent rejection, exact totals, consent enforcement and reset after login.');
}finally{
 if(child){child.kill();}
 if(mongoose.connection.name===dbName&&/^piano_qr_integration_[a-f0-9]{16}$/.test(dbName))await mongoose.connection.dropDatabase();
 await mongoose.disconnect();
}
