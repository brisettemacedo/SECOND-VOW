const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(path,requireFn=require){const out=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const exp={};new Function('exports','require',out)(exp,requireFn);return exp;}
const helpers=load('lib/returnReview.ts');
function handler({reviewed=false,role='admin',appealed=false}={}){
 const calls=[];
 const rows={claims:{id:'claim',order_id:'order',status:'refund_pending',return_tracking_number:'RETURN123',return_reviewed_at:reviewed?'2026-10-16T00:00:00Z':null,return_reviewed_by:reviewed?'admin':null},refunds:null,claim_resolutions:{decision:'authorize_return',status:appealed?'appealed':'final'},orders:{id:'order',status:'returned',total_mxn:1100,stripe_charge_id:'charge'},seller_payouts:null};
 function from(table){const chain={select(){return chain},eq(){return chain},in(){return chain},update(){return chain},maybeSingle:async()=>({data:rows[table]}),single:async()=>({data:rows[table]})};return chain;}
 const admin={from,rpc:async()=>({error:null})};
 const user={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role}})})})})};
 const route=load('app/api/stripe/refund/route.ts',name=>({
  '@/lib/supabase/server':{createClient:async()=>user},
  '@/lib/server/adminSupabase':{createAdminClient:()=>admin},
  '@/lib/server/requestSecurity':{isSameOriginRequest:()=>true},
  '@/lib/server/stripe':{stripeRequest:async(...args)=>{calls.push(args);return {id:'refund',status:'succeeded'}}},
  '@/lib/returnReview':helpers,
  '@/lib/server/notificationEmail':{sendPendingNotificationEmails:async()=>({sent:0})},
 }[name]??require(name)));
 return {post:()=>route.POST(new Request('https://second-vow.com/api/stripe/refund',{method:'POST',body:JSON.stringify({claimId:'claim'})})),calls};
}
test('refund endpoint rejects unverified return without invoking Stripe',async()=>{const h=handler();assert.equal((await h.post()).status,409);assert.equal(h.calls.length,0)});
test('refund endpoint rejects seller or buyer attempting admin action',async()=>{const h=handler({reviewed:true,role:'user'});assert.equal((await h.post()).status,403);assert.equal(h.calls.length,0)});
test('an appeal still blocks an administratively reviewed return',async()=>{const h=handler({reviewed:true,appealed:true});assert.equal((await h.post()).status,409);assert.equal(h.calls.length,0)});
test('verified resolved return invokes one idempotent refund for full original payment',async()=>{const h=handler({reviewed:true});assert.equal((await h.post()).status,200);assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'/refunds');assert.equal(h.calls[0][1].get('amount'),'110000');assert.equal(h.calls[0][3],'refund_claim')});
