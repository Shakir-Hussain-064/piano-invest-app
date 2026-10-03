import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {z} from 'zod';
import {plans,freshAccount,settle,buy,withdraw} from '../shared/domain.js';
import {encryptBank} from './bank-data.js';

import {POLICY_VERSION} from '../shared/policy.js';
import {prepareReferral,createReferralService,REFERRAL_BONUS} from './referrals.js';
import {createOwnerRouter} from './owner.js';
import {Recharge,qrPayment,publicClaim,createRechargeService} from './recharges.js';

const production=process.env.NODE_ENV==='production';
const moneyMode='live';
if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32||process.env.SESSION_SECRET.startsWith('replace-'))throw new Error('Set a random SESSION_SECRET of at least 32 characters.');
const uri=process.env.MONGODB_URI;
if(!uri)throw new Error('MONGODB_URI is required.');
try{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,connectTimeoutMS:10000});
}catch(error){
 console.error('MongoDB connection failed. Check MONGODB_URI and Atlas Network Access/IP allowlist.',error.message);
 process.exit(1);
}
console.log(`MongoDB connected · database: ${mongoose.connection.name}`);
const schema=new mongoose.Schema({email:{type:String,unique:true,required:true},name:String,role:{type:String,enum:['user','owner'],default:'user'},passwordHash:String,policyVersion:String,policyAcceptedAt:Date,moneyMode:{type:String,default:'live'},referralCode:{type:String,unique:true},referredBy:String,referralReward:mongoose.Schema.Types.Mixed,wallet:Number,totalEarned:Number,investments:[mongoose.Schema.Types.Mixed],transactions:[mongoose.Schema.Types.Mixed],withdrawals:[mongoose.Schema.Types.Mixed],orders:[mongoose.Schema.Types.Mixed]}, {optimisticConcurrency:true,timestamps:true});
schema.index({'orders.id':1});
const User=mongoose.model('User',schema);await User.init();await Recharge.init();
const app=express();
app.get('/healthz',(req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({ok:mongoose.connection.readyState===1}));
if(production)app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],frameSrc:["'none'"],connectSrc:["'self'"],imgSrc:["'self'",'data:','https://images.unsplash.com'],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],upgradeInsecureRequests:production?[]:null}}}));
const safeUser=u=>{const d=u.toObject?u.toObject():u;const {passwordHash,__v,orders,role,...safe}=d;safe.isOwner=role==='owner';safe.withdrawals=safe.withdrawals.map(({bankEncrypted,payoutBody,contactId,fundAccountId,lastError,...w})=>w);return safe;};
async function mutate(id,fn){for(let i=0;i<8;i++){const u=await User.findById(id);if(!u)throw new Error('Account not found.');if(u.moneyMode!=='live')throw new Error('This account cannot be used for live payments. Create a live account.');settle(u);await fn(u);for(const key of ['investments','transactions','withdrawals','orders'])u.markModified(key);try{await u.save();return u;}catch(e){if(e.name!=='VersionError')throw e;}}throw new Error('Wallet busy. Please retry.');}
const rechargeService=createRechargeService({mutate});
const referralService=createReferralService({User,mutate});
app.use(express.json({limit:'20kb'}));
app.use(session({name:'piano.sid',secret:process.env.SESSION_SECRET||randomBytes(48).toString('hex'),resave:false,saveUninitialized:false,store:MongoStore.create({mongoUrl:uri}),cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:7*86400000}}));
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.use('/api',rateLimit({windowMs:60000,limit:150,standardHeaders:'draft-8',legacyHeaders:false}));
app.get('/api/config',(req,res)=>{req.session.csrf ||=randomBytes(24).toString('hex');res.json({csrf:req.session.csrf,policyVersion:POLICY_VERSION,payoutsConfigured:false,withdrawRequestsEnabled:/^[a-f0-9]{64}$/i.test(process.env.BANK_DATA_KEY||''),qrPayment,plans});});
app.use('/api',(req,res,next)=>{if(!['GET','HEAD'].includes(req.method)&&(!req.session.csrf||req.headers['x-csrf-token']!==req.session.csrf))return res.status(403).json({error:'Session expired. Refresh the page.'});next();});
const authLimiter=rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false});
const credentials=z.object({email:z.email().max(120).transform(s=>s.toLowerCase().trim()),password:z.string().min(8).max(100)});
app.post('/api/signup',authLimiter,async(req,res,next)=>{try{
 const data=credentials.extend({name:z.string().trim().min(2).max(60),referral:z.string().max(30).optional()}).parse(req.body);
 if(!data.email.endsWith('@gmail.com'))throw new Error('Please use a Gmail address.');
 let ref;if(data.referral?.trim()){ref=await User.findOne({referralCode:data.referral.trim().toUpperCase(),moneyMode:'live'});if(!ref)throw new Error('Referral code not found.');}
 const u=new User({...freshAccount(data.email,data.name),moneyMode,passwordHash:await bcrypt.hash(data.password,12),referredBy:ref?.referralCode});
 if(ref)prepareReferral(u,ref._id);
 await u.save();
 if(ref){try{await referralService.complete(u);}catch{console.error('Referral bonus queued for recovery',u.id);}}
 res.status(201).json({ok:true,referralBonus:ref?REFERRAL_BONUS:0});
}catch(e){next(e);}});
app.post('/api/login',authLimiter,async(req,res,next)=>{try{const data=credentials.parse(req.body);const u=await User.findOne({email:data.email});if(!u||!await bcrypt.compare(data.password,u.passwordHash))return res.status(401).json({error:'Email or password is incorrect.'});await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.userId=u.id;req.session.csrf=randomBytes(24).toString('hex');res.json({user:safeUser(await mutate(u.id,()=>{})),csrf:req.session.csrf,policyAcknowledged:false});}catch(e){next(e);}});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('piano.sid');res.json({ok:true});}));
app.use('/api',(req,res,next)=>{if(!req.session.userId)return res.status(401).json({error:'Please log in.'});next();});
app.get('/api/me',async(req,res,next)=>{try{res.json({user:safeUser(await mutate(req.session.userId,()=>{})),policyAcknowledged:req.session.policyVersion===POLICY_VERSION});}catch(e){next(e);}});
app.post('/api/policy/acknowledge',async(req,res,next)=>{try{
 z.object({version:z.literal(POLICY_VERSION),accepted:z.literal(true)}).parse(req.body);
 await User.updateOne({_id:req.session.userId},{$set:{policyVersion:POLICY_VERSION,policyAcceptedAt:new Date()}});
 req.session.policyVersion=POLICY_VERSION;
 res.json({ok:true});
}catch(e){next(e);}});
app.use('/api',(req,res,next)=>{
 if(req.method==='POST'&&req.session.policyVersion!==POLICY_VERSION)return res.status(403).json({error:'Read and acknowledge the investment risk and privacy notice before continuing.'});
 next();
});
const money=z.number().int().min(10000).max(10000000);
const requestId=z.string().uuid();
app.use(['/api/plans/buy','/api/wallet/withdraw','/api/payments/claims'],async(req,res,next)=>{
 try{const account=await User.findById(req.session.userId).select('role');
 if(account?.role==='owner')return res.status(403).json({error:'Owner accounts use the owner dashboard. Customer wallet actions require a customer account.'});
 next();}catch(e){next(e);}
});
app.post('/api/plans/buy',async(req,res,next)=>{try{const d=z.object({planId:z.string(),requestId}).parse(req.body);res.json({user:safeUser(await mutate(req.session.userId,u=>buy(u,d.planId,Date.now(),d.requestId)))});}catch(e){next(e);}});
app.post('/api/wallet/withdraw',authLimiter,async(req,res,next)=>{try{
 const d=z.object({amount:money,bank:z.discriminatedUnion('method',[z.object({method:z.literal('bank'),name:z.string().trim().min(2).max(100),accountNumber:z.string().regex(/^\d{9,18}$/),ifsc:z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)}),z.object({method:z.literal('upi'),name:z.string().trim().min(2).max(100),upi:z.string().trim().regex(/^[-a-zA-Z0-9._]{2,256}@[a-zA-Z]{2,64}$/)})]),confirmAccount:z.string(),password:z.string().max(100),requestId}).parse(req.body);
 if(d.bank.method==='bank'&&d.bank.accountNumber!==d.confirmAccount)throw new Error('Bank account numbers do not match.');
 const account=await User.findById(req.session.userId);
 if(!account||!await bcrypt.compare(d.password,account.passwordHash))throw new Error('Enter your account password to confirm this withdrawal.');
 const enabled=/^[a-f0-9]{64}$/i.test(process.env.BANK_DATA_KEY||'');
 if(!enabled)throw new Error('Secure withdrawal storage is not configured. No funds have been deducted.');
 const u=await mutate(req.session.userId,u=>{
  if(u.withdrawals.some(w=>w.id===d.requestId))return;
  withdraw(u,d.amount,d.bank,Date.now(),d.requestId);
  const w=u.withdrawals.find(w=>w.id===d.requestId);w.provider='manual';
  if(enabled){w.bankEncrypted=encryptBank(d.bank,process.env.BANK_DATA_KEY);w.status='awaiting_owner';}
 });
 // Funds stay reserved until the owner explicitly authorizes or rejects this request.
 res.status(202).json({user:safeUser(u)});
}catch(e){next(e);}});

const claimInput=z.object({amount:money,utr:z.string().trim().regex(/^\d{12}$/,'Enter the 12-digit UPI UTR from your completed payment.'),requestId});
app.get('/api/payments/claims',async(req,res,next)=>{try{
 const claims=await Recharge.find({userId:req.session.userId}).sort({createdAt:-1}).limit(100);
 res.json({claims:claims.map(publicClaim)});
}catch(e){next(e);}});
app.post('/api/payments/claims',authLimiter,async(req,res,next)=>{try{
 const d=claimInput.parse(req.body);
 const existing=await Recharge.findById(d.requestId);
 if(existing){if(String(existing.userId)!==req.session.userId||existing.amount!==d.amount||existing.utr!==d.utr)return res.status(409).json({error:'This request has already been used. Start a new recharge.'});return res.json({claim:publicClaim(existing)});}
 if(await Recharge.countDocuments({userId:req.session.userId,status:'pending'})>=10)return res.status(429).json({error:'You already have 10 recharges awaiting review. Wait for review before submitting more.'});
 try{const claim=await Recharge.create({_id:d.requestId,userId:req.session.userId,amount:d.amount,utr:d.utr});res.status(202).json({claim:publicClaim(claim)});}
 catch(e){if(e.code===11000)return res.status(409).json({error:'This UTR or request has already been submitted. Each payment can be claimed only once.'});throw e;}
}catch(e){next(e);}});
app.use('/api/owner',(req,res,next)=>req.method==='GET'?next():authLimiter(req,res,next),async(req,res,next)=>{try{
 const owner=await User.findById(req.session.userId);
 if(owner?.role!=='owner')return res.status(403).json({error:'Owner access required.'});
 req.owner=owner;next();
}catch(e){next(e);}});
app.get('/api/owner/recharges',async(req,res,next)=>{try{
 const claims=await Recharge.find({status:{$in:['pending','approving']}}).sort({createdAt:1}).limit(100).populate('userId','name email');
 res.json({claims:claims.map(c=>({...publicClaim(c),account:c.userId?{id:c.userId.id,name:c.userId.name,email:c.userId.email}:null}))});
}catch(e){next(e);}});
app.post('/api/owner/recharges/:id/review',async(req,res,next)=>{try{
 const id=requestId.parse(req.params.id);
 const d=z.object({decision:z.enum(['approve','reject']),password:z.string().min(1).max(100),ownerConfirmed:z.boolean()}).parse(req.body);
 if(!await bcrypt.compare(d.password,req.owner.passwordHash))return res.status(403).json({error:'Incorrect owner password.'});
 const claim=await Recharge.findById(id);
 if(!claim)return res.status(404).json({error:'Recharge not found.'});

 if(d.decision==='approve'){
  if(!d.ownerConfirmed)throw new Error('Confirm your authorization to credit this recharge before approval.');
  await rechargeService.approve(id,req.owner._id,'Owner approved the stored recharge submission.');
 }else{
  const result=await Recharge.updateOne({_id:id,status:'pending'},{$set:{status:'rejected',reviewedBy:req.owner._id,reviewedAt:new Date(),reviewNote:'Recharge rejected by owner.'}});
  if(!result.modifiedCount)throw new Error('Only pending recharges can be rejected. Refresh the review list.');
 }
 res.json({ok:true});
}catch(e){next(e);}});
app.use('/api/owner',createOwnerRouter({User,mutate}));
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');app.use(express.static(dist));app.get('/{*path}',(req,res)=>res.sendFile(path.join(dist,'index.html')));
app.use((e,req,res,next)=>{
 console.error(e.name,e.code||'');
 const validation=e instanceof z.ZodError,domain=e.constructor===Error;
 const status=e.code===11000?409:e.status===413?413:validation||domain?400:500;
 const message=e.code===11000?'This record already exists.':e.status===413?'Request is too large.':validation?e.issues[0].message:domain?e.message:'The request could not be completed. Please retry.';
 res.status(status).json({error:message});
});
let running=false;
async function accrue(){if(running)return;running=true;try{await rechargeService.recover();await referralService.recover();for await(const u of User.find({moneyMode,'investments.0':{$exists:true}}).select('_id').cursor()){await mutate(u.id,()=>{});}
}catch(e){console.error('Worker:',e.message);}finally{running=false;}}
const timer=setInterval(accrue,15000);timer.unref();await accrue();
const port=process.env.PORT||3001;
const host=process.env.HOST||'0.0.0.0';
const server=app.listen(port,host,()=>console.log(`Piano API listening on ${host}:${port}`));
async function stop(){clearInterval(timer);server.close();await mongoose.disconnect();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
