import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {z} from 'zod';
import {plans,freshAccount,settle,buy,withdraw,creditOrder,transaction} from '../shared/domain.js';
import {createPayoutService,encryptBank,payoutsConfigured} from './payouts.js';

const production=process.env.NODE_ENV==='production';
const demoPayments=process.env.DEMO_PAYMENTS==='true';
const moneyMode=process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')?'live':'test';
if(process.env.RAZORPAYX_KEY_ID&&process.env.RAZORPAYX_KEY_ID.startsWith('rzp_live_')!==(moneyMode==='live'))throw new Error('Payment Gateway and RazorpayX must use the same test/live mode.');
if(moneyMode==='live'&&(!production||process.env.USE_MEMORY_DB==='true'))throw new Error('Live payments require production mode and a persistent database.');
if(demoPayments && process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_'))throw new Error('Disable DEMO_PAYMENTS before using live Razorpay keys.');
if(production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32))throw new Error('SESSION_SECRET must contain at least 32 characters.');
let uri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/piano';
let memory;
if(process.env.USE_MEMORY_DB==='true'){
  if(production)throw new Error('In-memory database is development-only.');
  const {MongoMemoryServer}=await import('mongodb-memory-server');memory=await MongoMemoryServer.create();uri=memory.getUri();
  console.log('Development database is temporary. Accounts are cleared when this process stops.');
}
await mongoose.connect(uri);
const schema=new mongoose.Schema({email:{type:String,unique:true,required:true},name:String,passwordHash:String,moneyMode:{type:String,default:'test'},referralCode:{type:String,unique:true},referredBy:String,wallet:Number,totalEarned:Number,investments:[mongoose.Schema.Types.Mixed],transactions:[mongoose.Schema.Types.Mixed],withdrawals:[mongoose.Schema.Types.Mixed],orders:[mongoose.Schema.Types.Mixed]}, {optimisticConcurrency:true,timestamps:true});
schema.index({'orders.id':1});
const User=mongoose.model('User',schema);await User.init();
const app=express();
if(production)app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://checkout.razorpay.com'],frameSrc:['https://api.razorpay.com','https://checkout.razorpay.com'],connectSrc:["'self'",'https://*.razorpay.com'],imgSrc:["'self'",'data:','https://images.unsplash.com','https://*.razorpay.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],upgradeInsecureRequests:production?[]:null}}}));
const safeUser=u=>{const d=u.toObject?u.toObject():u;const {passwordHash,__v,orders,...safe}=d;safe.withdrawals=safe.withdrawals.map(({bankEncrypted,payoutBody,contactId,fundAccountId,lastError,...w})=>w);return safe;};
async function mutate(id,fn){for(let i=0;i<8;i++){const u=await User.findById(id);if(!u)throw new Error('Account not found.');if((u.moneyMode||'test')!==moneyMode)throw new Error('This account belongs to a different payment mode. Use a separate live account and database.');settle(u);await fn(u);for(const key of ['investments','transactions','withdrawals','orders'])u.markModified(key);try{await u.save();return u;}catch(e){if(e.name!=='VersionError')throw e;}}throw new Error('Wallet busy. Please retry.');}
const payoutService=createPayoutService({loadUser:id=>User.findById(id),mutate});
function signature(body,secret,provided){if(!secret||typeof provided!=='string'||!/^[a-f0-9]{64}$/i.test(provided))return false;const expected=createHmac('sha256',secret).update(body).digest();return timingSafeEqual(expected,Buffer.from(provided,'hex'));}
async function razorpay(endpoint,body){
 if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)throw new Error('Razorpay keys are not configured yet.');
 const res=await fetch(`https://api.razorpay.com/v1/${endpoint}`,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await res.json();if(!res.ok)throw new Error('Razorpay could not process the request. Please try again.');return data;
}
app.post('/api/payments/webhook',express.raw({type:'application/json',limit:'100kb'}),async(req,res,next)=>{try{
 if(!signature(req.body,process.env.RAZORPAY_WEBHOOK_SECRET,req.headers['x-razorpay-signature']))return res.status(400).json({error:'Invalid webhook signature.'});
 const event=JSON.parse(req.body.toString());if(event.event==='payment.captured'){
 const payment=event.payload.payment.entity;const u=await User.findOne({'orders.id':payment.order_id});
 if(!u)return res.status(503).json({error:'Order not yet recorded; retry delivery.'});
 await mutate(u.id,u=>creditOrder(u,payment.order_id,payment));
 }res.json({ok:true});
}catch(e){next(e);}});
app.post('/api/payouts/webhook',express.raw({type:'application/json',limit:'100kb'}),async(req,res)=>{try{
 if(!signature(req.body,process.env.RAZORPAYX_WEBHOOK_SECRET,req.headers['x-razorpay-signature']))return res.status(400).json({error:'Invalid payout webhook signature.'});
 const event=JSON.parse(req.body.toString());
 if(event.event?.startsWith('payout.')){
  const p=event.payload?.payout?.entity;
  if(!p?.reference_id||!/^pout_[A-Za-z0-9]+$/.test(p.id))return res.status(400).json({error:'Invalid payout payload.'});
  const u=await User.findOne({'withdrawals.id':p.reference_id});
  if(!u)return res.status(503).json({error:'Withdrawal not yet recorded.'});
  await payoutService.acceptWebhook(u.id,p.reference_id,p.id);
 }
 res.json({ok:true});
}catch{res.status(503).json({error:'Payout reconciliation pending. Retry delivery.'});}});
app.use(express.json({limit:'20kb'}));
app.use(session({name:'piano.sid',secret:process.env.SESSION_SECRET||randomBytes(48).toString('hex'),resave:false,saveUninitialized:false,store:MongoStore.create({mongoUrl:uri}),cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:7*86400000}}));
app.use('/api',rateLimit({windowMs:60000,limit:150,standardHeaders:'draft-8',legacyHeaders:false}));
app.get('/api/config',(req,res)=>{req.session.csrf ||=randomBytes(24).toString('hex');res.json({csrf:req.session.csrf,demoPayments,payoutsConfigured:payoutsConfigured(process.env),razorpayConfigured:!!(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET),testMode:moneyMode==='test',plans});});
app.use('/api',(req,res,next)=>{if(!['GET','HEAD'].includes(req.method)&&(!req.session.csrf||req.headers['x-csrf-token']!==req.session.csrf))return res.status(403).json({error:'Session expired. Refresh the page.'});next();});
const authLimiter=rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false});
app.get('/api/captcha',(req,res)=>{const a=2+Math.floor(Math.random()*8),b=2+Math.floor(Math.random()*8);req.session.captcha={answer:String(a+b),expires:Date.now()+300000};res.json({question:`${a} + ${b}`});});
const credentials=z.object({email:z.email().max(120).transform(s=>s.toLowerCase().trim()),password:z.string().min(8).max(100)});
app.post('/api/signup',authLimiter,async(req,res,next)=>{try{
 const data=credentials.extend({name:z.string().trim().min(2).max(60),referral:z.string().max(30).optional(),captcha:z.string()}).parse(req.body);
 const captcha=req.session.captcha;delete req.session.captcha;
 if(!captcha||captcha.expires<Date.now()||data.captcha.trim()!==captcha.answer)throw new Error('Captcha expired or incorrect. Try a new one.');
 if(!data.email.endsWith('@gmail.com'))throw new Error('Please use a Gmail address.');
 let ref;if(data.referral){ref=await User.findOne({referralCode:data.referral.toUpperCase()});if(!ref)throw new Error('Referral code not found.');}
 const u=freshAccount(data.email,data.name);await User.create({...u,moneyMode,passwordHash:await bcrypt.hash(data.password,12),referredBy:ref?.referralCode});res.status(201).json({ok:true});
}catch(e){next(e);}});
app.post('/api/login',authLimiter,async(req,res,next)=>{try{const data=credentials.parse(req.body);const u=await User.findOne({email:data.email});if(!u||!await bcrypt.compare(data.password,u.passwordHash))return res.status(401).json({error:'Email or password is incorrect.'});await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.userId=u.id;req.session.csrf=randomBytes(24).toString('hex');res.json({user:safeUser(await mutate(u.id,()=>{})),csrf:req.session.csrf});}catch(e){next(e);}});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('piano.sid');res.json({ok:true});}));
app.use('/api',(req,res,next)=>{if(!req.session.userId)return res.status(401).json({error:'Please log in.'});next();});
app.get('/api/me',async(req,res,next)=>{try{res.json({user:safeUser(await mutate(req.session.userId,()=>{}))});}catch(e){next(e);}});
const money=z.number().int().min(10000).max(10000000);
const requestId=z.string().uuid();
app.post('/api/plans/buy',async(req,res,next)=>{try{const d=z.object({planId:z.string(),requestId}).parse(req.body);res.json({user:safeUser(await mutate(req.session.userId,u=>buy(u,d.planId,Date.now(),d.requestId)))});}catch(e){next(e);}});
app.post('/api/wallet/withdraw',authLimiter,async(req,res,next)=>{try{
 const d=z.object({amount:money,bank:z.object({name:z.string().trim().min(2).max(100),accountNumber:z.string().regex(/^\d{9,18}$/),ifsc:z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)}),confirmAccount:z.string(),password:z.string().max(100),requestId}).parse(req.body);
 if(d.bank.accountNumber!==d.confirmAccount)throw new Error('Bank account numbers do not match.');
 const account=await User.findById(req.session.userId);
 if(!account||!await bcrypt.compare(d.password,account.passwordHash))throw new Error('Enter your account password to confirm this withdrawal.');
 const enabled=payoutsConfigured(process.env);
 if(!enabled&&!demoPayments)throw new Error('Bank payouts are not configured yet. No funds have been deducted.');
 const u=await mutate(req.session.userId,u=>{
  if(u.withdrawals.some(w=>w.id===d.requestId))return;
  withdraw(u,d.amount,d.bank,Date.now(),d.requestId);
  const w=u.withdrawals.find(w=>w.id===d.requestId);w.provider=enabled?'razorpayx':'demo';
  if(enabled){w.bankEncrypted=encryptBank(d.bank,process.env.BANK_DATA_KEY);w.status='pending';}
 });
 // Persist the reservation before any external call. Background reconciliation retries safely.
 res.status(202).json({user:safeUser(u)});
}catch(e){next(e);}});
app.post('/api/wallet/demo-recharge',async(req,res,next)=>{try{if(!demoPayments)return res.status(403).json({error:'Demo recharge is disabled.'});const d=z.object({amount:money,requestId}).parse(req.body);res.json({user:safeUser(await mutate(req.session.userId,u=>{if(u.transactions.some(t=>t.id===d.requestId))return;u.wallet+=d.amount;transaction(u,'recharge',d.amount,'Demo wallet recharge',Date.now(),d.requestId);} ))});}catch(e){next(e);}});
app.post('/api/payments/order',async(req,res,next)=>{try{const {amount}=z.object({amount:money}).parse(req.body);const order=await razorpay('orders',{amount,currency:'INR',receipt:randomBytes(12).toString('hex')});await mutate(req.session.userId,u=>u.orders.push({id:order.id,amount,credited:false,createdAt:Date.now()}));res.json({order,key:process.env.RAZORPAY_KEY_ID});}catch(e){next(e);}});
app.post('/api/payments/verify',async(req,res,next)=>{try{const d=z.object({razorpay_order_id:z.string().regex(/^order_[A-Za-z0-9]+$/),razorpay_payment_id:z.string().regex(/^pay_[A-Za-z0-9]+$/),razorpay_signature:z.string()}).parse(req.body);const u=await User.findById(req.session.userId);const order=u.orders.find(o=>o.id===d.razorpay_order_id);if(!order||!signature(`${order.id}|${d.razorpay_payment_id}`,process.env.RAZORPAY_KEY_SECRET,d.razorpay_signature))throw new Error('Payment verification failed.');const payment=await razorpay(`payments/${d.razorpay_payment_id}`);res.json({user:safeUser(await mutate(u.id,u=>creditOrder(u,order.id,payment)))});}catch(e){next(e);}});
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');app.use(express.static(dist));app.get('/{*path}',(req,res)=>res.sendFile(path.join(dist,'index.html')));
app.use((e,req,res,next)=>{console.error(e.name, e.code||'');res.status(e.code===11000?409:400).json({error:e.code===11000?'This Gmail address is already registered.':e instanceof z.ZodError?e.issues[0].message:e.message||'Something went wrong.'});});
let running=false;
async function accrue(){if(running)return;running=true;try{for await(const u of User.find({moneyMode,'investments.paidDays':{$lt:20}}).select('_id').cursor()){await mutate(u.id,()=>{});}
 if(payoutsConfigured(process.env))for await(const u of User.find({moneyMode,'withdrawals.provider':'razorpayx'}).cursor()){
  for(const w of u.withdrawals){
   if(w.provider!=='razorpayx'||w.refunded||['failed','reversed','cancelled','rejected'].includes(w.status))continue;
   if(w.status==='processed'&&Date.now()-w.at>7*86400000)continue;
   if(Date.now()-(w.lastAttempt||0)<60000)continue;
   await mutate(u.id,u=>{u.withdrawals.find(x=>x.id===w.id).lastAttempt=Date.now();});
   try{await payoutService.reconcile(u.id,w.id);}catch(e){console.error('Payout reconciliation pending for request',w.id);}
  }
 }
}catch(e){console.error('Worker:',e.message);}finally{running=false;}}
const timer=setInterval(accrue,15000);timer.unref();await accrue();
const server=app.listen(process.env.PORT||3001,process.env.HOST||'127.0.0.1',()=>console.log(`Piano API http://127.0.0.1:${process.env.PORT||3001}`));
async function stop(){clearInterval(timer);server.close();await mongoose.disconnect();if(memory)await memory.stop();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
