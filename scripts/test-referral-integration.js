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
async function signup(c,email,referral='',expected=201){
 await c('/config');const {question}=await c('/captcha');const captcha=String(question.split(' + ').map(Number).reduce((x,y)=>x+y));
 return c('/signup',{name:'Referral Fixture',email,password,captcha,referral},expected);
}
try{
 await mongoose.connect(uri.toString());await start();const sender=client(),receiver=client();
 const initial=await signup(sender,'sender@gmail.com');assert.equal(initial.referralBonus,0);
 const inviter=(await sender('/login',{email:'sender@gmail.com',password})).user;assert.equal(inviter.wallet,0);
 const added=await signup(receiver,'receiver@gmail.com',inviter.referralCode.toLowerCase());assert.equal(added.referralBonus,25000);
 const newcomer=(await receiver('/login',{email:'receiver@gmail.com',password})).user;
 assert.equal(newcomer.wallet,25000);assert.equal((await sender('/me')).user.wallet,25000);
 assert.equal(newcomer.totalEarned,0);assert.equal(newcomer.transactions.filter(t=>t.type==='referral_bonus').length,1);
 await signup(client(),'receiver@gmail.com',inviter.referralCode,409);assert.equal((await sender('/me')).user.wallet,25000);
 await signup(client(),'invalid@gmail.com','DOESNOTEXIST',400);assert.equal(await mongoose.connection.collection('users').countDocuments({email:'invalid@gmail.com'}),0);
 const race=await Promise.all([client(),client()].map(c=>signup(c,'race@gmail.com',inviter.referralCode,null)));
 assert.deepEqual(race.map(r=>r.httpStatus).sort(),[201,409]);assert.equal((await sender('/me')).user.wallet,50000);
 const plain=client();await signup(plain,'plain@gmail.com');assert.equal((await plain('/login',{email:'plain@gmail.com',password})).user.wallet,0);
 // Simulate a crash after crediting the inviter, before marking reward complete.
 await mongoose.connection.collection('users').updateOne({_id:new mongoose.Types.ObjectId(newcomer._id)},{$set:{'referralReward.status':'pending'}});
 child.kill();await new Promise(resolve=>child.once('exit',resolve));await start();
 const dbSender=await mongoose.connection.collection('users').findOne({_id:new mongoose.Types.ObjectId(inviter._id)});
 const dbReceiver=await mongoose.connection.collection('users').findOne({_id:new mongoose.Types.ObjectId(newcomer._id)});
 assert.equal(dbSender.wallet,50000);assert.equal(dbReceiver.wallet,25000);assert.equal(dbReceiver.referralReward.status,'complete');
 assert.equal(dbSender.transactions.filter(t=>t.type==='referral_bonus').length,2);
 console.log('PASS: ₹250 to both accounts, no-code/invalid-code behavior, duplicate signup, concurrent signup and crash recovery without double credit.');
}finally{
 if(child){child.kill();}
 if(mongoose.connection.name===dbName&&/^piano_qr_integration_[a-f0-9]{16}$/.test(dbName))await mongoose.connection.dropDatabase();
 await mongoose.disconnect();
}
