import {Router} from 'express';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {reviewWithdrawal} from '../shared/domain.js';
import {Recharge} from './recharges.js';
const pending=['awaiting_owner','pending','queued','processing','scheduled'];
const sum=(rows,fn)=>rows.reduce((total,row)=>total+fn(row),0);
export function userMetrics(u){
 const active=u.investments.filter(p=>p.earned<p.total);
 return {id:String(u._id),name:u.name,email:u.email,createdAt:u.createdAt,wallet:u.wallet,totalEarned:u.totalEarned,activePlans:active.length,dailyCredits:sum(active,p=>p.daily),totalInvested:sum(u.investments,p=>p.price),pendingWithdrawals:sum(u.withdrawals.filter(w=>pending.includes(w.status)),w=>w.amount),paidWithdrawals:sum(u.withdrawals.filter(w=>w.status==='processed'),w=>w.amount)};
}
export function createOwnerRouter({User,mutate}){
 const router=Router();
 router.get('/analytics',async(req,res)=>{
  const [accounts,recharges]=await Promise.all([
   User.aggregate([{$match:{moneyMode:'live'}},{$project:{wallet:1,totalEarned:1,active:{$filter:{input:'$investments',as:'p',cond:{$lt:['$$p.earned','$$p.total']}}},totalInvested:{$sum:'$investments.price'},paid:{$filter:{input:'$withdrawals',as:'w',cond:{$eq:['$$w.status','processed']}}},pending:{$filter:{input:'$withdrawals',as:'w',cond:{$in:['$$w.status',pending]}}}}},{$group:{_id:null,totalUsers:{$sum:1},walletBalance:{$sum:'$wallet'},totalEarned:{$sum:'$totalEarned'},totalInvested:{$sum:'$totalInvested'},activePlans:{$sum:{$size:'$active'}},dailyCredits:{$sum:{$sum:'$active.daily'}},paidWithdrawals:{$sum:{$sum:'$paid.amount'}},pendingWithdrawalAmount:{$sum:{$sum:'$pending.amount'}},pendingWithdrawalCount:{$sum:{$size:'$pending'}}}}]),
   Recharge.aggregate([{$group:{_id:'$status',count:{$sum:1},amount:{$sum:'$amount'}}}])
  ]);
  res.json({totals:accounts[0]||{totalUsers:0,walletBalance:0,totalEarned:0,totalInvested:0,activePlans:0,dailyCredits:0,paidWithdrawals:0,pendingWithdrawalAmount:0,pendingWithdrawalCount:0},recharges:Object.fromEntries(recharges.map(r=>[r._id,{count:r.count,amount:r.amount}])),payoutsConfigured:false,asOf:new Date().toISOString()});
 });
 router.get('/users',async(req,res)=>{
  const page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
  const q=z.string().trim().max(100).default('').parse(req.query.q);
  const match={moneyMode:'live'};if(q){const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');match.$or=[{name:{$regex:escaped,$options:'i'}},{email:{$regex:escaped,$options:'i'}}];}
  const [rows,total]=await Promise.all([User.find(match).select('name email createdAt wallet totalEarned investments withdrawals').sort({createdAt:-1,_id:-1}).skip((page-1)*20).limit(20).lean(),User.countDocuments(match)]);
  res.json({users:rows.map(userMetrics),page,total,pages:Math.ceil(total/20)});
 });
 router.get('/withdrawals',async(req,res)=>{
  const view=z.enum(['pending','history']).default('pending').parse(req.query.view);
  const page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
  const match={moneyMode:'live','withdrawals.status':view==='pending'?{$in:pending}:{$nin:pending}};
  const data=await User.aggregate([{$unwind:'$withdrawals'},{$match:match},{$sort:{'withdrawals.at':view==='pending'?1:-1,_id:1}},{$facet:{rows:[{$skip:(page-1)*20},{$limit:20},{$project:{name:1,email:1,withdrawals:1}}],count:[{$count:'total'}]}}]);
  const result=data[0],total=result.count[0]?.total||0;
  res.json({page,total,pages:Math.ceil(total/20),withdrawals:result.rows.map(u=>{
   const w=u.withdrawals;return {id:w.id,userId:String(u._id),name:u.name,email:u.email,amount:w.amount,method:w.method,bank:w.bank,status:w.status,at:w.at,utr:w.utr,reviewNote:w.reviewNote,ownerApprovedAt:w.ownerApprovedAt,canReview:!w.ownerApprovedAt&&!w.payoutBody&&!w.payoutId&&!w.refunded&&['awaiting_owner','pending'].includes(w.status)};
  })});
 });
 router.post('/withdrawals/:userId/:id/review',async(req,res)=>{
  const userId=z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.userId),id=z.string().uuid().parse(req.params.id);
  const d=z.object({decision:z.enum(['initiate','reject']),password:z.string().min(1).max(100),note:z.string().trim().min(5).max(300),confirmed:z.literal(true)}).parse(req.body);
  if(!await bcrypt.compare(d.password,req.owner.passwordHash))return res.status(403).json({error:'Incorrect owner password.'});
  if(d.decision==='initiate')return res.status(503).json({error:'Automatic payouts have been removed. No transfer was initiated; this request remains awaiting review.'});
  await mutate(userId,u=>reviewWithdrawal(u,id,d.decision,req.owner._id,d.note));
  res.json({ok:true,message:'Withdrawal rejected and reserved balance restored.'});
 });
 return router;
}
