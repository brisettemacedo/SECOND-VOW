const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function handler(rpcError=null){
 const tracked=[];
 const chain={select(){return chain},eq(){return chain},update(){return chain},single:async()=>({data:{id:'shipment',tracking_number:'AUTHORIZED_GUIDE'}})};
 const api={auth:{getUser:async()=>({data:{user:{id:'buyer'}}})},rpc:async()=>({error:rpcError})};
 const mocks={
  '@/lib/supabase/server':{createClient:async()=>api},
  '@/lib/server/adminSupabase':{createAdminClient:()=>({from:()=>chain})},
  '@/lib/server/ship24':{createShip24Tracker:async(input)=>{tracked.push(input);return {trackerId:'tracker'}}},
  '@/lib/server/rateLimit':{consumeRateLimit:async()=>true},
  '@/lib/server/requestSecurity':{isSameOriginRequest:()=>true},
  '@/lib/server/notificationEmail':{sendPendingNotificationEmails:async()=>({sent:0})},
 };
 const compiled=ts.transpileModule(fs.readFileSync('app/api/tracking/register-return/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exp={};new Function('exports','require',compiled)(exp,name=>mocks[name]??require(name));
 return {tracked,post:()=>exp.POST(new Request('https://second-vow.com/api/tracking/register-return',{method:'POST',body:JSON.stringify({orderId:'order',carrier:'carrier',trackingNumber:'CLIENT_SUBSTITUTION'})}))};
}
test('tracker follows the guide validated and stored by the database, never client substitution',async()=>{const h=handler();assert.equal((await h.post()).status,200);assert.equal(h.tracked[0].trackingNumber,'AUTHORIZED_GUIDE')});
test('a rejected return registration never creates an external tracker',async()=>{const h=handler({message:'Falta comprobante de admisión'});assert.equal((await h.post()).status,400);assert.equal(h.tracked.length,0)});
